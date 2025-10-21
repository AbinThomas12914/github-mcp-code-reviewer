#!/usr/bin/env node

/**
 * Simple MCP Test to isolate communication issues
 */

import { spawn } from 'child_process';

async function simpleTest() {
  console.log('🧪 Simple MCP Communication Test\n');
  
  const server = spawn('node', ['build/index.js'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: '/Users/A-10710/Documents/IBS/AI/Pr',
    env: { ...process.env, GITHUB_TOKEN: process.env.GITHUB_TOKEN }
  });
  
  // Listen for stderr (should have server startup message)
  server.stderr.on('data', (data) => {
    console.log('STDERR:', data.toString().trim());
  });
  
  // Listen for stdout (should have JSON-RPC responses)
  server.stdout.on('data', (data) => {
    console.log('STDOUT RAW:', JSON.stringify(data.toString()));
    console.log('STDOUT PARSED:');
    try {
      const response = JSON.parse(data.toString());
      console.log(JSON.stringify(response, null, 2));
    } catch (error) {
      console.log('PARSE ERROR:', error.message);
      console.log('RAW DATA:', data.toString());
    }
  });
  
  server.on('error', (error) => {
    console.error('SERVER ERROR:', error);
  });
  
  // Wait a moment for server to start
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Send a simple tools/list request
  console.log('\n📤 Sending tools/list request...');
  const request = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
    params: {}
  };
  
  server.stdin.write(JSON.stringify(request) + '\n');
  
  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  console.log('\n📤 Sending configure_github_auth request...');
  const authRequest = {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "configure_github_auth",
      arguments: {
        authType: "token",
        token: process.env.GITHUB_TOKEN
      }
    }
  };
  
  server.stdin.write(JSON.stringify(authRequest) + '\n');
  
  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  console.log('\n🛑 Terminating server...');
  server.kill();
}

simpleTest().catch(console.error);