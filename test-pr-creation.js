#!/usr/bin/env node
/**
 * Standalone PR Creation Script for GitHub MCP Server
 * - Authenticates
 * - Scans page_classes/*.js files
 * - Creates analyzed PR committing those files only
 */
import { spawn, execSync } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

class PrCreationClient {
  constructor(automationExecutorPath = null) {
    this.serverProcess = null;
    this.requestId = 1;
    this.repository = null; // Will be extracted from Git config
    
    // Git-based path resolution with optional override
    this.projectRoot = this.resolveProjectRoot();
    this.providedAutomationExecutorPath = automationExecutorPath;
    this.gitConfig = this.loadGitConfiguration();
    this.automationExecutorPath = null; // Will be resolved dynamically
  }

  resolveProjectRoot() {
    const __filename = fileURLToPath(import.meta.url);
    return path.dirname(__filename);
  }

  loadGitConfiguration() {
    const config = {
      workspaceRoot: null,
      repositoryPaths: []
    };

    try {
      // Try to find workspace root using Git
      try {
        const gitRoot = execSync('git rev-parse --show-toplevel', { 
          cwd: this.projectRoot, 
          encoding: 'utf-8' 
        }).trim();
        
        config.workspaceRoot = path.dirname(gitRoot);
        console.log(`📁 Git workspace root: ${config.workspaceRoot}`);
      } catch (error) {
        config.workspaceRoot = path.dirname(this.projectRoot);
      }

      // Generate possible repository paths based on Git workspace structure
      if (config.workspaceRoot) {
        config.repositoryPaths = [
          // No hardcoded repository paths - must be provided via command line or environment
        ];
      }

      // If automationExecutorPath provided as argument, prioritize it
      if (this.providedAutomationExecutorPath) {
        config.repositoryPaths.unshift(this.providedAutomationExecutorPath);
        console.log(`🎯 Command-line argument provided: ${this.providedAutomationExecutorPath}`);
      }

      return config;
    } catch (error) {
      const explicitPaths = [];
      
      if (this.providedAutomationExecutorPath) {
        explicitPaths.push(this.providedAutomationExecutorPath);
      }
      
      return {
        workspaceRoot: path.dirname(this.projectRoot),
        repositoryPaths: explicitPaths
      };
    }
  }

  /**
   * Extract Git configuration from AutomationExecutor repository
   */
  async extractRepositoryConfiguration(repoPath) {
    console.log(`🔍 Extracting Git configuration from: ${repoPath}`);
    
    const repoConfig = {
      repository: null,
      owner: null,
      repoName: null,
      currentBranch: null
    };

    try {
      // Get remote URL and parse repository info
      try {
        const remoteUrl = execSync('git remote get-url origin', { 
          cwd: repoPath, 
          encoding: 'utf-8' 
        }).trim();
        
        console.log(`🔗 Remote URL: ${remoteUrl}`);
        
        // Parse GitHub repository from URL
        const githubMatch = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
        if (githubMatch) {
          repoConfig.owner = githubMatch[1];
          repoConfig.repoName = githubMatch[2];
          repoConfig.repository = `${repoConfig.owner}/${repoConfig.repoName}`;
          console.log(`📦 Repository: ${repoConfig.repository}`);
        } else {
          throw new Error('Repository URL could not be parsed. Please ensure this is a valid GitHub repository.');
        }
      } catch (error) {
        console.log('⚠️  No Git remote configured');
        throw new Error('No Git remote configured. Please ensure the repository has a valid remote URL.');
      }

      // Get current branch
      try {
        const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { 
          cwd: repoPath, 
          encoding: 'utf-8' 
        }).trim();
        
        repoConfig.currentBranch = currentBranch;
        console.log(`🌿 Current branch: ${currentBranch}`);
      } catch (error) {
        throw new Error('Could not determine current Git branch. Please ensure you are in a valid Git repository.');
      }

      return repoConfig;
    } catch (error) {
      console.error('❌ Failed to extract repository configuration:', error.message);
      throw error;
    }
  }

  async discoverTargetRepository() {
    console.log('🔍 Discovering target repository using Git configuration...');
    
    const searchPaths = [
      ...this.gitConfig.repositoryPaths,
      process.env.TARGET_REPOSITORY_PATH
    ].filter(Boolean);

    if (searchPaths.length === 0) {
      throw new Error('No repository paths provided. Please specify a repository path via command line argument or TARGET_REPOSITORY_PATH environment variable.');
    }

    for (const searchPath of searchPaths) {
      try {
        await fs.access(searchPath);
        
        // Verify it's the correct Git repository
        try {
          const gitRemote = execSync('git remote get-url origin', { 
            cwd: searchPath, 
            encoding: 'utf-8' 
          }).trim();
          
          console.log(`✅ Valid Git repository: ${searchPath}`);
          return searchPath;
        } catch (gitError) {
          console.log(`✅ Valid directory structure: ${searchPath}`);
          return searchPath;
        }
      } catch (error) {
        // Continue searching
      }
    }
    throw new Error('Target repository not found. Please provide a valid repository path.');
  }

  async initialize() {
    console.log('\n🚀 Initializing GitHub MCP PR Creation Test...\n');

    // Load Git configuration and find AutomationExecutor repository
    const gitConfig = this.loadGitConfiguration();
    
    let repoPath = null;
    for (const candidatePath of gitConfig.repositoryPaths) {
      try {
        await fs.access(candidatePath);
        repoPath = candidatePath;
        console.log(`✅ Found target repository at: ${repoPath}`);
        break;
      } catch (error) {
        // Continue searching
      }
    }
    
    if (!repoPath) {
      throw new Error('Target repository not found. Please provide a valid repository path via command line argument or TARGET_REPOSITORY_PATH environment variable.');
    }

    // Extract repository configuration from Git
    this.repoConfig = await this.extractRepositoryConfiguration(repoPath);
    this.currentRepository = repoPath;

    console.log('\n� Repository Configuration:');
    console.log(`   Repository: ${this.repoConfig.repository}`);
    console.log(`   Branch: ${this.repoConfig.currentBranch}`);
    console.log(`   Local Path: ${repoPath}\n`);

    // Start MCP server
    console.log('🚀 Starting MCP Server...');
    this.serverProcess = spawn('node', ['build/index.js'], {
      cwd: this.projectRoot,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Wait for server to be ready
    await this.delay(2000);

    console.log('🔗 Connected to MCP server');

    return this.currentRepository;
  }  async findValidAutomationExecutorPath() {
    const possiblePaths = [
      path.resolve(this.projectRoot, '..', 'AutomationExecutor'),
      path.resolve(this.projectRoot, '..', '..', 'AutomationExecutor'),
      path.resolve(this.projectRoot, 'AutomationExecutor'),
      process.env.AUTOMATION_EXECUTOR_PATH,
      '/Users/A-10710/Documents/IBS/AI/AutomationExecutor'
    ].filter(Boolean);

    for (const testPath of possiblePaths) {
      try {
        await fs.access(testPath);
        await fs.access(path.join(testPath, 'page_classes'));
        return testPath;
      } catch (error) {
        // Continue searching
      }
    }
    return null;
  }

  async sendRequest(method, params) {
    const request = { jsonrpc: '2.0', id: this.requestId++, method, params };
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout waiting for MCP response')), 30000);
      let buffer = '';
      const handler = data => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const resp = JSON.parse(line);
            if (resp.id === request.id) {
              clearTimeout(timeout);
              this.serverProcess.stdout.removeListener('data', handler);
              return resp.error ? reject(new Error(resp.error.message)) : resolve(resp.result);
            }
          } catch (_) {}
        }
      };
      this.serverProcess.stdout.on('data', handler);
      this.serverProcess.stdin.write(JSON.stringify(request) + '\n');
    });
  }

  async callTool(name, args) {
    console.log(`🔧 Calling tool: ${name}`);
    const result = await this.sendRequest('tools/call', { name, arguments: args });
    if (result.content && result.content[0] && result.content[0].text) {
      console.log(`✨ Result: ${result.content[0].text.substring(0, 200)}...`);
    }
    return result;
  }

  /**
   * Parse .gitignore files and create ignore patterns
   */
  async parseGitignorePatterns(repoPath) {
    const gitignorePatterns = [];
    
    try {
      const gitignorePath = path.join(repoPath, '.gitignore');
      const gitignoreContent = await fs.readFile(gitignorePath, 'utf-8');
      
      const lines = gitignoreContent.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          // Convert gitignore patterns to regex-like patterns
          let pattern = trimmed
            .replace(/\./g, '\\.')  // Escape dots
            .replace(/\*/g, '.*')   // Convert * to .*
            .replace(/\?/g, '.')    // Convert ? to .
            .replace(/\/$/, '');    // Remove trailing slash
          
          gitignorePatterns.push(new RegExp(pattern));
        }
      }
      
      console.log(`� Loaded ${gitignorePatterns.length} gitignore patterns`);
    } catch (error) {
      console.log('📋 No .gitignore file found or unable to read it');
    }
    
    // Add common patterns to always ignore
    gitignorePatterns.push(
      /^\.git$/,
      /^node_modules$/,
      /^\.DS_Store$/,
      /^Thumbs\.db$/,
      /^\.vscode$/,
      /^\.idea$/,
      /\.log$/,
      /\.tmp$/,
      /\.temp$/
    );
    
    return gitignorePatterns;
  }

  /**
   * Check if a file should be ignored based on gitignore patterns
   */
  shouldIgnoreFile(filePath, repoPath, ignorePatterns) {
    const relativePath = path.relative(repoPath, filePath);
    const fileName = path.basename(filePath);
    
    for (const pattern of ignorePatterns) {
      if (pattern.test(relativePath) || pattern.test(fileName)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Recursively scan directory for all files, respecting gitignore
   */
  async scanDirectoryRecursively(dir, repoPath, ignorePatterns, results = []) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        // Skip if matches gitignore patterns
        if (this.shouldIgnoreFile(fullPath, repoPath, ignorePatterns)) {
          continue;
        }
        
        if (entry.isDirectory()) {
          // Recursively scan subdirectories
          await this.scanDirectoryRecursively(fullPath, repoPath, ignorePatterns, results);
        } else if (entry.isFile()) {
          // Only include text files that might contain code
          const ext = path.extname(entry.name).toLowerCase();
          const textExtensions = [
            '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.c', '.cpp', '.h', '.hpp',
            '.cs', '.php', '.rb', '.go', '.rs', '.swift', '.kt', '.scala', '.sh',
            '.html', '.css', '.scss', '.less', '.sass', '.vue', '.svelte',
            '.json', '.xml', '.yaml', '.yml', '.md', '.txt', '.sql'
          ];
          
          if (textExtensions.includes(ext) || !ext) {
            const stats = await fs.stat(fullPath);
            if (stats.size > 0 && stats.size < 1024 * 1024) { // Skip files larger than 1MB
              results.push({
                path: path.relative(repoPath, fullPath),
                localPath: fullPath,
                size: stats.size,
                extension: ext
              });
            }
          }
        }
      }
    } catch (error) {
      console.log(`⚠️  Could not scan directory ${dir}: ${error.message}`);
    }
    
    return results;
  }

  async scanPageClassesFiles() {
    if (!this.currentRepository) {
      throw new Error('Target repository not discovered. Call initialize() first.');
    }
    
    console.log('🔍 Scanning all files in repository for commit (respecting .gitignore)...');
    
    // Parse gitignore patterns
    const ignorePatterns = await this.parseGitignorePatterns(this.currentRepository);
    
    // Scan all files recursively
    const allFiles = await this.scanDirectoryRecursively(
      this.currentRepository, 
      this.currentRepository, 
      ignorePatterns
    );
    
    // Limit files for PR creation to avoid overwhelming
    const maxFiles = 10;
    const filesToCommit = allFiles.slice(0, maxFiles);
    
    if (allFiles.length > maxFiles) {
      console.log(`⚠️  Found ${allFiles.length} files, committing first ${maxFiles} for PR`);
    }
    
    console.log(`✅ Collected ${filesToCommit.length} files for commit`);
    
    // Show file type breakdown
    const extensionCounts = {};
    filesToCommit.forEach(file => {
      const ext = file.extension || 'no extension';
      extensionCounts[ext] = (extensionCounts[ext] || 0) + 1;
    });
    
    console.log('📊 Files to commit by type:');
    Object.entries(extensionCounts)
      .sort(([,a], [,b]) => b - a)
      .forEach(([ext, count]) => {
        console.log(`   ${ext}: ${count} files`);
      });
    
    return filesToCommit;
  }

  async run() {
    // Auth first
    console.log('\n🔐 Authenticating...');
    await this.callTool('configure_github_auth', { authType: 'token', token: process.env.GITHUB_TOKEN });

    // Scan files
    const filesToCommit = await this.scanPageClassesFiles();
    if (!filesToCommit.length) {
      console.log('⚠️  No files to commit, aborting PR creation');
      return;
    }

    // Create PR
    console.log('\n📝 Creating analyzed PR with repository files...');
    const prResult = await this.callTool('create_analyzed_pr', {
      repository: this.repoConfig.repository,
      branchName: `mcp-repository-files-pr-${Date.now()}`,
      title: 'MCP Analyzed PR: Repository Files',
      baseBranch: this.repoConfig.currentBranch || 'main',
      includeAnalysis: true,
      autoDescription: true,
      filesToCommit
    });

    if (prResult.content && prResult.content[0] && prResult.content[0].text) {
      console.log('\n✅ PR Creation Finished');
    }
  }

  async cleanup() {
    if (this.serverProcess) {
      console.log('\n🛑 Shutting down MCP Server...');
      this.serverProcess.kill();
      await this.delay(1000);
    }
  }

  delay(ms) { return new Promise(r => setTimeout(r, ms)); }
}

async function main() {
  // Parse command-line arguments
  const providedAutomationExecutorPath = process.argv[2];
  
  if (!process.env.GITHUB_TOKEN) {
    console.error('❌ GITHUB_TOKEN is required');
    console.log('💡 Set it with: export GITHUB_TOKEN="your-token-here"');
    console.log('🔗 Create token at: https://github.com/settings/tokens');
    console.log('\n🔧 Git configuration tips:');
    console.log('   - Check workspace: git rev-parse --show-toplevel');
    console.log('   - Configure user: git config user.name "Your Name"');
    console.log('\n🔧 Usage examples:');
    console.log('   node test-pr-creation.js');
    console.log('   node test-pr-creation.js /path/to/target-repository');
    console.log('   node test-pr-creation.js ~/Documents/target-repository');
    process.exit(1);
  }

  const tester = new PrCreationClient(providedAutomationExecutorPath);
  try {
    await tester.initialize();
    await tester.run();
  } catch (e) {
    console.error('❌ Error during Git-based PR creation:', e.message);
  } finally {
    await tester.cleanup();
  }
}

main();
