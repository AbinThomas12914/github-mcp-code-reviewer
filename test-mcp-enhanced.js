#!/usr/bin/env node

/**
 * Enhanced MCP Test Client for GitHub MCP Server
 * Tests all MCP tools against the AutomationExecutor repository with proper setup
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

class EnhancedMcpTestClient {
  constructor() {
    this.serverProcess = null;
    this.requestId = 1;
    this.testResults = [];
    this.repository = "AbinThomas12914/AutomationExecutor";
    this.automationExecutorPath = "/Users/A-10710/Documents/IBS/AI/AutomationExecutor";
  }

  async initialize() {
    console.log('🚀 Initializing Enhanced MCP Test Client...\n');
    
    // Verify AutomationExecutor repository exists
    try {
      await fs.access(this.automationExecutorPath);
      console.log('✅ AutomationExecutor repository found');
    } catch (error) {
      console.error('❌ AutomationExecutor repository not found at:', this.automationExecutorPath);
      console.log('💡 Please ensure the repository is cloned to the correct location');
      throw error;
    }
    
    // Start the MCP server
    console.log('📡 Starting MCP Server...');
    this.serverProcess = spawn('node', ['build/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: '/Users/A-10710/Documents/IBS/AI/Pr',
      env: { ...process.env, GITHUB_TOKEN: process.env.GITHUB_TOKEN }
    });

    this.serverProcess.stderr.on('data', (data) => {
      console.log('📟 Server:', data.toString().trim());
    });

    this.serverProcess.on('error', (error) => {
      console.error('❌ Server Error:', error);
    });

    // Wait for server to initialize
    await this.delay(3000);
    console.log('✅ MCP Server initialized\n');
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
          remoteBranch: 'main',
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
          targetBranch: 'main',
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
    console.log('� Scanning page_classes directory...');
    const dir = path.join(this.automationExecutorPath, 'page_classes');
    const results = [];
    try {
      const entries = await fs.readdir(dir);
      for (const file of entries) {
        if (file.endsWith('.js')) {
          const full = path.join(dir, file);
          const stats = await fs.stat(full);
          if (stats.isFile() && stats.size > 0) {
            console.log(`  📄 ${file} (${stats.size} bytes)`);
            results.push({
              repoPath: `page_classes/${file}`,
              localPath: full,
              size: stats.size
            });
          }
        }
      }
    } catch (e) {
      console.error('❌ Failed to read page_classes:', e.message);
    }
    return results;
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
  const client = new EnhancedMcpTestClient();
  
  try {
    await client.initialize();
    await client.runComprehensiveTest();
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    console.log('\n🔧 Troubleshooting steps:');
    console.log('   1. Ensure GITHUB_TOKEN is set: export GITHUB_TOKEN="your-token"');
    console.log('   2. Verify AutomationExecutor is cloned to: /Users/A-10710/Documents/IBS/AI/AutomationExecutor');
    console.log('   3. Check that MCP server builds successfully: npm run build');
    console.log('   4. Verify network connectivity to GitHub API');
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

// Validate environment
if (!process.env.GITHUB_TOKEN) {
  console.error('❌ Error: GITHUB_TOKEN environment variable is required');
  console.log('💡 Set it with: export GITHUB_TOKEN="your-token-here"');
  console.log('🔗 Create token at: https://github.com/settings/tokens');
  console.log('📋 Required scopes: repo, workflow, read:org');
  process.exit(1);
}

// Run the enhanced tests
main();