#!/usr/bin/env node

/**
 * Enhanced MCP Test Client for GitHub MCP Server
 * Tests all MCP tools against the AutomationExecutor repository with proper setup
 */

import { spawn, execSync } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

class EnhancedMcpTestClient {
  constructor(automationExecutorPath = null) {
    this.serverProcess = null;
    this.requestId = 1;
    this.testResults = [];
    this.repository = null; // Will be extracted from Git config
    
    // Git-based path resolution with optional override
    this.projectRoot = this.resolveProjectRoot();
    this.providedAutomationExecutorPath = automationExecutorPath;
    this.gitConfig = this.loadGitConfiguration();
    this.automationExecutorPath = null; // Will be resolved dynamically
  }

  /**
   * Resolves the MCP project root directory generically
   */
  resolveProjectRoot() {
    // Get current file directory for ES modules
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    
    // This test file is in project root, so return its directory
    return __dirname;
  }

  /**
   * Load Git configuration for repository discovery
   * Follows GitHub API best practices and robust error handling
   */
  loadGitConfiguration() {
    const config = {
      workspaceRoot: null,
      repositoryPaths: [],
      userEmail: null,
      userName: null
    };

    try {
      // Get user configuration for comprehensive logging
      try {
        config.userEmail = execSync('git config user.email', { encoding: 'utf-8' }).trim();
        config.userName = execSync('git config user.name', { encoding: 'utf-8' }).trim();
        console.log(`🔧 Git user: ${config.userName} <${config.userEmail}>`);
      } catch (error) {
        console.log('⚠️  Git user not configured (non-critical)');
      }

      // Try to find workspace root using Git
      try {
        const gitRoot = execSync('git rev-parse --show-toplevel', { 
          cwd: this.projectRoot, 
          encoding: 'utf-8' 
        }).trim();
        
        // Get the parent directory of Git root for workspace discovery
        config.workspaceRoot = path.dirname(gitRoot);
        console.log(`📁 Git workspace root: ${config.workspaceRoot}`);
      } catch (error) {
        console.log('⚠️  Not in a Git repository, using current directory as workspace');
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
      console.error('❌ Failed to load Git configuration:', error.message);
      // No fallback paths - must be provided explicitly
      const explicitPaths = [];
      
      if (this.providedAutomationExecutorPath) {
        explicitPaths.push(this.providedAutomationExecutorPath);
      }
      
      return {
        workspaceRoot: path.dirname(this.projectRoot),
        repositoryPaths: explicitPaths,
        userEmail: null,
        userName: null
      };
    }
  }

  /**
   * Extract Git configuration from AutomationExecutor repository
   * Gets remote URL and repository information for MCP tools
   */
  async extractRepositoryConfiguration(repoPath) {
    console.log(`🔍 Extracting Git configuration from: ${repoPath}`);
    
    const repoConfig = {
      remoteName: null,
      remoteUrl: null,
      repository: null,
      owner: null,
      repoName: null,
      currentBranch: null,
      hasChanges: false
    };

    try {
      // Get remote URL
      try {
        const remoteUrl = execSync('git remote get-url origin', { 
          cwd: repoPath, 
          encoding: 'utf-8' 
        }).trim();
        
        repoConfig.remoteUrl = remoteUrl;
        console.log(`🔗 Remote URL: ${remoteUrl}`);
        
        // Parse GitHub repository from URL
        const githubMatch = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
        if (githubMatch) {
          repoConfig.owner = githubMatch[1];
          repoConfig.repoName = githubMatch[2];
          repoConfig.repository = `${repoConfig.owner}/${repoConfig.repoName}`;
          console.log(`📦 Repository: ${repoConfig.repository}`);
        } else {
          console.log('⚠️  Not a GitHub repository or unrecognized URL format');
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
        console.log('⚠️  Could not determine current branch');
        throw new Error('Could not determine current Git branch. Please ensure you are in a valid Git repository.');
      }

      // Check for uncommitted changes
      try {
        const gitStatus = execSync('git status --porcelain', { 
          cwd: repoPath, 
          encoding: 'utf-8' 
        }).trim();
        
        repoConfig.hasChanges = !!gitStatus;
        if (gitStatus) {
          console.log('📝 Repository has uncommitted changes (good for testing)');
          console.log(`   Modified files: ${gitStatus.split('\n').length}`);
        } else {
          console.log('🔧 Repository is clean (no local modifications)');
        }
      } catch (error) {
        console.log('ℹ️  Could not check Git status');
      }

      return repoConfig;
    } catch (error) {
      console.error('❌ Failed to extract repository configuration:', error.message);
      throw error;
    }
  }

  /**
   * Dynamically discover target repository using Git-aware paths
   * Implements comprehensive error handling without fallback mechanisms
   */
  async discoverTargetRepository() {
    console.log('🔍 Discovering target repository using Git configuration...');
    
    const searchPaths = [
      // Git configuration based paths (highest priority)
      ...this.gitConfig.repositoryPaths,
      // Environment variable override
      process.env.TARGET_REPOSITORY_PATH
    ].filter(Boolean); // Remove undefined values

    if (searchPaths.length === 0) {
      throw new Error('No repository paths provided. Please specify a repository path via command line argument or TARGET_REPOSITORY_PATH environment variable.');
    }

    console.log(`� Searching ${searchPaths.length} possible locations:`);
    
    for (const searchPath of searchPaths) {
      console.log(`   🔎 Checking: ${searchPath}`);
      
      try {
        // Verify directory exists
        await fs.access(searchPath);
        
        // Verify it's a valid repository structure
        const pageClassesDir = path.join(searchPath, 'page_classes');
        await fs.access(pageClassesDir);
        
        // Optional: Verify it's a Git repository
        try {
          const gitRemote = execSync('git remote get-url origin', { 
            cwd: searchPath, 
            encoding: 'utf-8' 
          }).trim();
          
          console.log(`✅ Valid Git repository found: ${searchPath}`);
          console.log(`🔗 Remote: ${gitRemote}`);
          return searchPath;
        } catch (gitError) {
          // Not a Git repository, but has correct structure
          console.log(`✅ Valid directory structure (not Git repository): ${searchPath}`);
          return searchPath;
        }
        
      } catch (error) {
        console.log(`   ❌ Not accessible: ${error.message}`);
      }
    }

    throw new Error('Target repository not found. Please provide a valid repository path with a page_classes directory.');
  }

  async initialize() {
    console.log('🚀 Initializing Enhanced MCP Test Client with Git Configuration...\n');
    console.log(`📁 Project root: ${this.projectRoot}`);
    console.log(`🗂️  Git workspace: ${this.gitConfig.workspaceRoot || 'Not detected'}`);
    
    if (this.providedAutomationExecutorPath) {
      console.log(`🎯 Using provided repository path: ${this.providedAutomationExecutorPath}`);
    }
    
    // Discover target repository using Git configuration
    const discoveredPath = await this.discoverTargetRepository();
    
    this.automationExecutorPath = discoveredPath;
    console.log(`\n✅ Target repository discovered at: ${this.automationExecutorPath}`);
    
    // Extract Git configuration from the AutomationExecutor repository
    const repoConfig = await this.extractRepositoryConfiguration(this.automationExecutorPath);
    this.repository = repoConfig.repository;
    this.repoConfig = repoConfig;
    
    console.log(`� Using repository: ${this.repository}`);
    console.log(`🌿 Target branch: ${repoConfig.currentBranch}`);
    
    // Start MCP server with Git-aware environment
    console.log('\n📡 Starting MCP Server with Git configuration...');
    this.serverProcess = spawn('node', ['build/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: this.projectRoot,
      env: { 
        ...process.env, 
        GITHUB_TOKEN: process.env.GITHUB_TOKEN,
        PROJECT_ROOT: this.projectRoot,
        GIT_WORKSPACE: this.gitConfig.workspaceRoot,
        TARGET_REPOSITORY_PATH: this.automationExecutorPath,
        TARGET_REPOSITORY: this.repository,
        TARGET_BRANCH: repoConfig.currentBranch
      }
    });

    this.serverProcess.stderr.on('data', (data) => {
      console.log('📟 Server:', data.toString().trim());
    });

    this.serverProcess.on('error', (error) => {
      console.error('❌ Server Error:', error);
      console.log('🔧 Git-aware troubleshooting:');
      console.log('   1. Ensure project is built: npm run build');
      console.log(`   2. Check build output: ${path.join(this.projectRoot, 'build', 'index.js')}`);
      console.log('   3. Verify Git workspace configuration');
      console.log('   4. Check Node.js version compatibility');
      console.log(`   5. Verify repository path: ${this.automationExecutorPath}`);
    });

    // Wait for server initialization with robust error handling
    await this.delay(3000);
    console.log('✅ MCP Server initialized with Git configuration\n');
  }

  /**
   * Attempts to find valid target repository path by testing accessibility
   */
  async findValidTargetRepositoryPath() {
    // Deprecated: Use discoverTargetRepository() instead
    return await this.discoverTargetRepository();
  }

  /**
   * Enhanced scanning using Git-discovered repository path
   */
  async scanPageClassesFiles() {
    if (!this.automationExecutorPath) {
      throw new Error('Target repository not discovered. Call initialize() first.');
    }
    
    console.log(`🔍 Scanning page_classes in Git-discovered repository...`);
    const dir = path.join(this.automationExecutorPath, 'page_classes');
    const results = [];
    
    try {
      const entries = await fs.readdir(dir);
      
      for (const file of entries) {
        if (file.endsWith('.js')) {
          const fullPath = path.join(dir, file);
          const stats = await fs.stat(fullPath);
          
          if (stats.isFile() && stats.size > 0) {
            console.log(`  📄 ${file} (${stats.size} bytes)`);
            results.push({
              repoPath: `page_classes/${file}`,
              localPath: fullPath,
              size: stats.size
            });
          }
        }
      }
      
      console.log(`✅ Found ${results.length} page class files in Git repository`);
      return results;
      
    } catch (error) {
      console.error('❌ Failed to scan page_classes in Git repository:', error.message);
      throw error;
    }
  }

  async sendRequest(method, params) {
    const request = {
      jsonrpc: "2.0",
      id: this.requestId++,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout after 30 seconds'));
      }, 30000);

      let responseBuffer = '';
      
      const responseHandler = (data) => {
        responseBuffer += data.toString();
        
        // Look for complete JSON responses (ending with newline)
        const lines = responseBuffer.split('\n');
        
        // Keep the last (potentially incomplete) line in the buffer
        responseBuffer = lines.pop();
        
        // Process complete lines
        for (const line of lines) {
          if (line.trim()) {
            try {
              const response = JSON.parse(line);
              
              // Check if this is the response we're waiting for
              if (response.id === request.id) {
                clearTimeout(timeout);
                this.serverProcess.stdout.removeListener('data', responseHandler);
                
                if (response.error) {
                  reject(new Error(`MCP Error: ${response.error.message}`));
                } else {
                  resolve(response.result);
                }
                return;
              }
            } catch (parseError) {
              // Ignore parse errors for partial responses
            }
          }
        }
      };

      this.serverProcess.stdout.on('data', responseHandler);
      this.serverProcess.stdin.write(JSON.stringify(request) + '\n');
    });
  }

  async testTool(toolName, args) {
    try {
      console.log(`🔧 Testing ${toolName}...`);
      console.log(`📋 Arguments:`, JSON.stringify(args, null, 2));
      
      const result = await this.sendRequest('tools/call', { 
        name: toolName, 
        arguments: args 
      });
      
      console.log(`✅ ${toolName} completed successfully`);
      
      // Parse and display result content
      if (result.content && result.content[0] && result.content[0].text) {
        const resultText = result.content[0].text;
        
        // Check if it's an error message
        if (resultText.startsWith('Error')) {
          console.log(`⚠️  Result: ${resultText}`);
          return { success: false, message: resultText, fullResult: result };
        } else {
          console.log(`✨ Result preview: ${resultText.substring(0, 200)}...`);
          return { success: true, message: 'Operation completed successfully', fullResult: result };
        }
      }
      
      return { success: true, message: 'Operation completed successfully', fullResult: result };
      
    } catch (error) {
      console.error(`❌ ${toolName} failed:`, error.message);
      return { success: false, message: error.message, fullResult: null };
    }
  }

  async runComprehensiveTest() {
    console.log('🎯 Starting Enhanced MCP Server Test\n');
    console.log('=' .repeat(60));
    
    try {
      // STEP 0: Configure GitHub Authentication First
      console.log('\n🔐 STEP 0: configure_github_auth');
      console.log('-'.repeat(40));
      
      const authResult = await this.testTool('configure_github_auth', {
        authType: 'token',
        token: process.env.GITHUB_TOKEN
      });
      
      this.testResults.push({
        tool: 'configure_github_auth',
        success: authResult.success,
        result: authResult.fullResult,
        message: authResult.message
      });
      
      if (!authResult.success) {
        console.log('❌ Authentication failed - stopping test execution');
        return;
      }
      
      console.log('🔑 Authentication configured successfully\n');
      // Scan all page_classes files we will process
      const pageClassFiles = await this.scanPageClassesFiles();
      if (pageClassFiles.length === 0) {
        console.log('⚠️  No page_classes JS files found. Stopping.');
        return;
      }
      console.log(`✅ Found ${pageClassFiles.length} page_classes files to process`);

      // Iterate each page class file and run all three tools
      for (const file of pageClassFiles) {
        console.log('\n' + '-'.repeat(60));
        console.log(`📄 Processing: ${file.repoPath}`);

        // compare_with_remote
        const compareResult = await this.testTool('compare_with_remote', {
          localPath: file.localPath,
          remoteBranch: this.repoConfig.currentBranch,
          repository: this.repository,
          analysisDepth: 'detailed'
        });
        this.testResults.push({
          tool: 'compare_with_remote',
          file: file.repoPath,
          success: compareResult.success,
          result: compareResult.fullResult,
          message: compareResult.message
        });

        // analyze_code_changes
        const analyzeResult = await this.testTool('analyze_code_changes', {
          filePath: file.localPath,
          repository: this.repository,
          targetBranch: this.repoConfig.currentBranch,
          includeMethodTracking: true,
          includeLogicAnalysis: true
        });
        this.testResults.push({
          tool: 'analyze_code_changes',
          file: file.repoPath,
          success: analyzeResult.success,
          result: analyzeResult.fullResult,
          message: analyzeResult.message
        });

        // refactor_with_patterns
        const refactorResult = await this.testTool('refactor_with_patterns', {
          localPath: file.localPath,
          repository: this.repository,
          preserveLogic: true,
          createBackup: true,
          refactoringRules: ['consistent-naming', 'organize-imports', 'format-code']
        });
        this.testResults.push({
          tool: 'refactor_with_patterns',
          file: file.repoPath,
          success: refactorResult.success,
          result: refactorResult.fullResult,
          message: refactorResult.message
        });
      }

      // PR creation removed from comprehensive test; use test-pr-creation.js for PR flow

    } catch (error) {
      console.error('❌ Test execution failed:', error.message);
      this.testResults.push({
        tool: 'test_execution',
        success: false,
        error: error.message
      });
    }

    await this.generateEnhancedTestReport();
  }

  async setupTestFiles() {
    console.log('📁 Verifying page_classes directory exists...');
    try {
      const dir = path.join(this.automationExecutorPath, 'page_classes');
      await fs.access(dir);
      console.log('✅ page_classes directory accessible');
    } catch (error) {
      console.log('❌ page_classes directory not accessible:', error.message);
    }
  }

  async scanFilesForCommit() {
    console.log('🔍 Legacy scanFilesForCommit called - returning page_classes only.');
    const files = await this.scanPageClassesFiles();
    return files.map(f => ({ path: f.repoPath, localPath: f.localPath }));
  }

  async scanPageClassesFiles() {
    if (!this.automationExecutorPath) {
      throw new Error('Target repository not discovered. Call initialize() first.');
    }
    
    console.log(`🔍 Scanning page_classes in Git-discovered repository...`);
    const dir = path.join(this.automationExecutorPath, 'page_classes');
    const results = [];
    
    try {
      const entries = await fs.readdir(dir);
      
      for (const file of entries) {
        if (file.endsWith('.js')) {
          const fullPath = path.join(dir, file);
          const stats = await fs.stat(fullPath);
          
          if (stats.isFile() && stats.size > 0) {
            console.log(`  📄 ${file} (${stats.size} bytes)`);
            results.push({
              repoPath: `page_classes/${file}`,
              localPath: fullPath,
              size: stats.size
            });
          }
        }
      }
      
      console.log(`✅ Found ${results.length} page class files in Git repository`);
      return results;
      
    } catch (error) {
      console.error('❌ Failed to scan page_classes in Git repository:', error.message);
      throw error;
    }
  }

  async generateEnhancedTestReport() {
    console.log('\n📋 GENERATING ENHANCED TEST REPORT');
    console.log('=' .repeat(60));
    
    const successful = this.testResults.filter(t => t.success);
    const failed = this.testResults.filter(t => !t.success);
    
    const report = {
      timestamp: new Date().toISOString(),
      repository: this.repository,
      automationExecutorPath: this.automationExecutorPath,
      totalTests: this.testResults.length,
      successfulTests: successful.length,
      failedTests: failed.length,
      successRate: ((successful.length / this.testResults.length) * 100).toFixed(1),
      results: this.testResults,
      summary: {
        successful: successful.map(t => ({ tool: t.tool, message: t.message })),
        failed: failed.map(t => ({ tool: t.tool, message: t.message }))
      }
    };

    // Save report to file
    const reportPath = './mcp-enhanced-test-report.json';
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`📄 Enhanced report saved to: ${reportPath}`);
    console.log('\n🎯 ENHANCED TEST SUMMARY:');
    console.log(`   Repository: ${this.repository}`);
    console.log(`   Total Tests: ${report.totalTests}`);
    console.log(`   ✅ Successful: ${report.successfulTests}`);
    console.log(`   ❌ Failed: ${report.failedTests}`);
    console.log(`   📊 Success Rate: ${report.successRate}%`);
    
    // Display detailed results with messages
    console.log('\n📝 DETAILED RESULTS WITH MESSAGES:');
    this.testResults.forEach((test, index) => {
      const status = test.success ? '✅' : '❌';
      console.log(`   ${index + 1}. ${status} ${test.tool}`);
      console.log(`      ${test.message}`);
    });

    // Show successful operations
    if (successful.length > 0) {
      console.log('\n🌟 SUCCESSFUL OPERATIONS:');
      successful.forEach(test => {
        console.log(`   ✅ ${test.tool}: ${test.message}`);
      });
    }

    // Show failed operations with suggestions
    if (failed.length > 0) {
      console.log('\n🔧 FAILED OPERATIONS & SUGGESTIONS:');
      failed.forEach(test => {
        console.log(`   ❌ ${test.tool}: ${test.message}`);
        
        // Provide specific suggestions based on failure type
        if (test.message.includes('GitHub client not configured')) {
          console.log('      💡 Suggestion: Ensure GitHub token is valid and configure_github_auth runs first');
        } else if (test.message.includes('ENOENT') || test.message.includes('no such file')) {
          console.log('      💡 Suggestion: Check file paths and ensure AutomationExecutor is properly cloned');
        } else if (test.message.includes('timeout')) {
          console.log('      💡 Suggestion: Check network connection and GitHub API rate limits');
        }
      });
    }

    console.log('\n🎉 Enhanced test execution completed!');
    console.log('=' .repeat(60));
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async cleanup() {
    if (this.serverProcess) {
      console.log('\n🛑 Shutting down MCP Server...');
      this.serverProcess.kill();
      await this.delay(1000);
    }
  }
}

// Main execution
async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const automationExecutorPath = args[0]; // First argument is the AutomationExecutor path
  
  if (automationExecutorPath) {
    console.log(`🎯 Command-line AutomationExecutor path: ${automationExecutorPath}`);
  }
  
  const client = new EnhancedMcpTestClient(automationExecutorPath);
  
  try {
    await client.initialize();
    await client.runComprehensiveTest();
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    console.log('\n🔧 Troubleshooting steps:');
    console.log('   1. Ensure GITHUB_TOKEN is set: export GITHUB_TOKEN="your-token"');
    console.log('   2. Verify AutomationExecutor path is correct');
    console.log('   3. Check that MCP server builds successfully: npm run build');
    console.log('   4. Verify network connectivity to GitHub API');
    console.log('\n📋 Usage examples:');
    console.log('   node test-mcp-enhanced.js');
    console.log('   node test-mcp-enhanced.js "/path/to/target-repository"');
    console.log('   export TARGET_REPOSITORY_PATH="/path/to/target-repository" && node test-mcp-enhanced.js');
  } finally {
    await client.cleanup();
    process.exit(0);
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n🛑 Received interrupt signal...');
  process.exit(0);
});

// Enhanced Git-aware environment validation
if (!process.env.GITHUB_TOKEN) {
  console.error('❌ Error: GITHUB_TOKEN environment variable is required');
  console.log('💡 Set it with: export GITHUB_TOKEN="your-token-here"');
  console.log('🔗 Create token at: https://github.com/settings/tokens');
  console.log('📋 Required scopes: repo, workflow, read:org');
  console.log('\n🔧 Git configuration tips:');
  console.log('   - Check workspace: git rev-parse --show-toplevel');
  console.log('   - Configure user: git config user.name "Your Name"');
  console.log('   - Configure email: git config user.email "your.email@example.com"');
  console.log('\n🔧 Optional: Set custom target repository path:');
  console.log('   export TARGET_REPOSITORY_PATH="/custom/path/to/target-repository"');
  process.exit(1);
}

// Run the enhanced tests
main();