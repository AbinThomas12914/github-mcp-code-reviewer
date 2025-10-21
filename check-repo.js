#!/usr/bin/env node

/**
 * Simple script to check repository structure via GitHub API
 */

import fetch from 'node-fetch';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO = 'AbinThomas12914/AutomationExecutor';

async function checkRepo() {
  console.log('🔍 Checking repository structure...\n');
  
  try {
    // Check repository exists
    const repoResponse = await fetch(`https://api.github.com/repos/${REPO}`, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (!repoResponse.ok) {
      console.error('❌ Repository not accessible:', repoResponse.status, repoResponse.statusText);
      return;
    }
    
    const repoData = await repoResponse.json();
    console.log('✅ Repository found:', repoData.full_name);
    console.log('📝 Description:', repoData.description);
    console.log('🌿 Default branch:', repoData.default_branch);
    console.log('👀 Private:', repoData.private);
    
    // Check contents
    const contentsResponse = await fetch(`https://api.github.com/repos/${REPO}/contents`, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (!contentsResponse.ok) {
      console.error('❌ Contents not accessible:', contentsResponse.status, contentsResponse.statusText);
      return;
    }
    
    const contents = await contentsResponse.json();
    console.log('\n📁 Repository contents:');
    contents.forEach(item => {
      const type = item.type === 'dir' ? '📁' : '📄';
      console.log(`   ${type} ${item.name}`);
    });
    
    // Check page_classes directory
    const pageClassesResponse = await fetch(`https://api.github.com/repos/${REPO}/contents/page_classes`, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (pageClassesResponse.ok) {
      const pageClasses = await pageClassesResponse.json();
      console.log('\n📁 page_classes directory:');
      pageClasses.forEach(item => {
        const type = item.type === 'dir' ? '📁' : '📄';
        console.log(`   ${type} ${item.name}`);
      });
    } else {
      console.log('\n❌ page_classes directory not found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkRepo();