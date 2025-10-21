#!/usr/bin/env node
/**
 * Standalone PR Creation Script for GitHub MCP Server
 * - Authenticates
 * - Scans page_classes/*.js files
 * - Creates analyzed PR committing those files only
 */
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

class PrCreationClient {
  constructor() {
    this.serverProcess = null;
    this.requestId = 1;
    this.repository = 'AbinThomas12914/AutomationExecutor';
    this.automationExecutorPath = '/Users/A-10710/Documents/IBS/AI/AutomationExecutor';
  }

  async initialize() {
    console.log('🚀 Initializing PR Creation Client...');
    try {
      await fs.access(this.automationExecutorPath);
      console.log('✅ AutomationExecutor repository found');
    } catch (e) {
      console.error('❌ Repository not found at', this.automationExecutorPath);
      throw e;
    }
    console.log('📡 Starting MCP Server...');
    this.serverProcess = spawn('node', ['build/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: '/Users/A-10710/Documents/IBS/AI/Pr',
      env: { ...process.env, GITHUB_TOKEN: process.env.GITHUB_TOKEN }
    });
    this.serverProcess.stderr.on('data', d => console.log('📟 Server:', d.toString().trim()));
    await this.delay(3000);
    console.log('✅ MCP Server ready');
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
    console.log('🔍 Scanning page_classes for commit files...');
    const dir = path.join(this.automationExecutorPath, 'page_classes');
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
      console.error('❌ Failed to read page_classes:', e.message);
    }
    console.log(`✅ Collected ${out.length} files`);
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
      repository: this.repository,
      branchName: `mcp-page-classes-pr-${Date.now()}`,
      title: 'MCP Analyzed PR: page_classes',
      baseBranch: 'main',
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
  if (!process.env.GITHUB_TOKEN) {
    console.error('❌ GITHUB_TOKEN is required');
    process.exit(1);
  }
  const client = new PrCreationClient();
  try {
    await client.initialize();
    await client.run();
  } catch (e) {
    console.error('❌ Error during PR creation:', e.message);
  } finally {
    await client.cleanup();
  }
}

main();
