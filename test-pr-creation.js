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
        await fs.access(path.join(searchPath, 'page_classes'));
        
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
    throw new Error('Target repository not found. Please provide a valid repository path with a page_classes directory.');
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

  async scanPageClassesFiles() {
    if (!this.currentRepository) {
      throw new Error('Target repository not discovered. Call initialize() first.');
    }
    
    console.log('🔍 Scanning page_classes for commit files using Git-discovered path...');
    const dir = path.join(this.currentRepository, 'page_classes');
    const out = [];
    try {
      const entries = await fs.readdir(dir);
      for (const f of entries) {
        if (f.endsWith('.js')) {
          const full = path.join(dir, f);
            const stats = await fs.stat(full);
          if (stats.isFile() && stats.size > 0) {
            console.log(`  📄 ${f} (${stats.size} bytes)`);
            out.push({ path: `page_classes/${f}`, localPath: full });
          }
        }
      }
    } catch (e) {
      console.error('❌ Failed to read page_classes from Git repository:', e.message);
    }
    console.log(`✅ Collected ${out.length} files from Git repository`);
    return out;
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
    console.log('\n📝 Creating analyzed PR with page_classes files...');
    const prResult = await this.callTool('create_analyzed_pr', {
      repository: this.repoConfig.repository,
      branchName: `mcp-page-classes-pr-${Date.now()}`,
      title: 'MCP Analyzed PR: page_classes',
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
