#!/usr/bin/env node

/**
 * MCP Test Client for GitHub MCP Server
 * Tests all MCP tools against the AutomationExecutor repository
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

class McpTestClient {
  constructor() {
    this.serverProcess = null;
    this.requestId = 1;
    this.testResults = [];
    this.repository = "AbinThomas12914/AutomationExecutor";
    this.testFilesPath = "/Users/A-10710/Documents/IBS/AI/AutomationExecutor";
  }

  async initialize() {
    console.log('🚀 Initializing MCP Test Client...\n');
    
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

      const responseHandler = (data) => {
        clearTimeout(timeout);
        try {
          const response = JSON.parse(data.toString());
          if (response.error) {
            reject(new Error(`MCP Error: ${response.error.message}`));
          } else {
            resolve(response.result);
          }
        } catch (parseError) {
          reject(new Error(`Parse Error: ${parseError.message}`));
        }
      };

      this.serverProcess.stdout.once('data', responseHandler);
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
      return result;
      
    } catch (error) {
      console.error(`❌ ${toolName} failed:`, error.message);
      throw error;
    }
  }

  async runComprehensiveTest() {
    console.log('🎯 Starting Comprehensive MCP Server Test\n');
    console.log('=' .repeat(60));
    
    try {
      // Test 1: compare_with_remote
      console.log('\n📊 TEST 1: compare_with_remote');
      console.log('-'.repeat(40));
      
      const compareResult = await this.testTool('compare_with_remote', {
        localPath: 'page_classes/HomePage.js',
        remoteBranch: 'main',
        repository: this.repository,
        analysisDepth: 'detailed'
      });
      
      this.testResults.push({
        tool: 'compare_with_remote',
        success: true,
        result: compareResult
      });
      console.log('📈 Comparison analysis completed\n');

      // Test 2: analyze_code_changes
      console.log('🔍 TEST 2: analyze_code_changes');
      console.log('-'.repeat(40));
      
      const analyzeResult = await this.testTool('analyze_code_changes', {
        filePath: 'page_classes/FlightSearchPage.js',
        repository: this.repository,
        targetBranch: 'main',
        includeMethodTracking: true,
        includeLogicAnalysis: true
      });
      
      this.testResults.push({
        tool: 'analyze_code_changes',
        success: true,
        result: analyzeResult
      });
      console.log('🧠 Code analysis completed\n');

      // Test 3: refactor_with_patterns
      console.log('🔧 TEST 3: refactor_with_patterns');
      console.log('-'.repeat(40));
      
      const refactorResult = await this.testTool('refactor_with_patterns', {
        localPath: 'page_classes/HomePage.js',
        repository: this.repository,
        preserveLogic: true,
        createBackup: true,
        refactoringRules: ['consistent-naming', 'organize-imports', 'format-code']
      });
      
      this.testResults.push({
        tool: 'refactor_with_patterns',
        success: true,
        result: refactorResult
      });
      console.log('⚙️ Refactoring completed\n');

      // Test 4: create_analyzed_pr
      console.log('📝 TEST 4: create_analyzed_pr');
      console.log('-'.repeat(40));
      
      const prResult = await this.testTool('create_analyzed_pr', {
        repository: this.repository,
        branchName: `mcp-test-${Date.now()}`,
        title: 'Enhanced AutomationExecutor Pages - MCP Analysis',
        baseBranch: 'main',
        includeAnalysis: true,
        autoDescription: true
      });
      
      this.testResults.push({
        tool: 'create_analyzed_pr',
        success: true,
        result: prResult
      });
      console.log('🎉 Pull Request created\n');

      // Test 5: configure_github_auth
      console.log('🔐 TEST 5: configure_github_auth');
      console.log('-'.repeat(40));
      
      const authResult = await this.testTool('configure_github_auth', {
        authType: 'token',
        token: process.env.GITHUB_TOKEN
      });
      
      this.testResults.push({
        tool: 'configure_github_auth',
        success: true,
        result: authResult
      });
      console.log('🔑 Authentication configured\n');

    } catch (error) {
      console.error('❌ Test execution failed:', error.message);
      this.testResults.push({
        tool: 'test_execution',
        success: false,
        error: error.message
      });
    }

    await this.generateTestReport();
  }

  async generateTestReport() {
    console.log('\n📋 GENERATING TEST REPORT');
    console.log('=' .repeat(60));
    
    const report = {
      timestamp: new Date().toISOString(),
      repository: this.repository,
      totalTests: this.testResults.length,
      successfulTests: this.testResults.filter(t => t.success).length,
      failedTests: this.testResults.filter(t => !t.success).length,
      results: this.testResults
    };

    // Save report to file
    const reportPath = './mcp-test-report.json';
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`📄 Report saved to: ${reportPath}`);
    console.log('\n🎯 TEST SUMMARY:');
    console.log(`   Total Tests: ${report.totalTests}`);
    console.log(`   ✅ Successful: ${report.successfulTests}`);
    console.log(`   ❌ Failed: ${report.failedTests}`);
    console.log(`   📊 Success Rate: ${((report.successfulTests / report.totalTests) * 100).toFixed(1)}%`);
    
    // Display detailed results
    console.log('\n📝 DETAILED RESULTS:');
    this.testResults.forEach((test, index) => {
      const status = test.success ? '✅' : '❌';
      console.log(`   ${index + 1}. ${status} ${test.tool}`);
      if (!test.success && test.error) {
        console.log(`      Error: ${test.error}`);
      }
    });

    console.log('\n🎉 Test execution completed!');
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
  const client = new McpTestClient();
  
  try {
    await client.initialize();
    await client.runComprehensiveTest();
  } catch (error) {
    console.error('❌ Fatal error:', error);
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

// Check for GitHub token
if (!process.env.GITHUB_TOKEN) {
  console.error('❌ Error: GITHUB_TOKEN environment variable is required');
  console.log('💡 Set it with: export GITHUB_TOKEN="your-token-here"');
  process.exit(1);
}

// Run the tests
main();