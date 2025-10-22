# GitHub MCP Server Usage Guide

This GitHub MCP Server provides automated code comparison, refactoring, and pull request creation capabilities.

## Quick Start

### 1. Set up Environment
```bash
export GITHUB_TOKEN="your-github-personal-access-token"
```

### 2. Build the Server
```bash
npm run build
```

### 3. Run Tests with Command-Line Arguments

#### Enhanced Testing with Code Analysis
```bash
# Use with provided repository path
node test-mcp-enhanced.js /path/to/target-repository

# Use with environment variable
export TARGET_REPOSITORY_PATH="/path/to/target-repository"
node test-mcp-enhanced.js
```

#### Pull Request Creation
```bash
# Use with provided repository path
node test-pr-creation.js /path/to/target-repository

# Use with environment variable
export TARGET_REPOSITORY_PATH="/path/to/target-repository"
node test-pr-creation.js
```

## Features

### 🔍 Code Analysis & Comparison
- **compare_with_remote**: Compare local files with remote repository
- **analyze_code_changes**: Detect method name changes and logical differences
- **refactor_with_patterns**: Apply intelligent refactoring based on remote patterns

### 🚀 Pull Request Automation
- **create_analyzed_pr**: Create comprehensive PRs with automated analysis
- Automatic commit of modified files
- Enhanced PR descriptions with change summaries
- Git-aware configuration extraction

### 🛠️ Configuration Management
- **configure_github_auth**: Set up GitHub authentication
- Git-based repository discovery
- Dynamic branch and repository detection

## How It Works

1. **Git Configuration Extraction**: The scripts automatically:
   - Extract remote repository URL from Git configuration
   - Detect current branch and repository owner/name
   - Find the repository path using workspace discovery

2. **Intelligent Analysis**: 
   - Compares local changes with remote repository
   - Analyzes method renames and logical changes
   - Suggests refactoring patterns based on existing code

3. **Automated PR Creation**:
   - Creates feature branches automatically
   - Commits changes with descriptive messages
   - Generates comprehensive PR descriptions
   - Includes detailed change analysis

## Command-Line Options

Both test scripts now require a repository path argument:

```bash
# Format
node [script-name].js [repository-path]

# Examples
node test-mcp-enhanced.js /Users/username/Documents/target-repository
node test-pr-creation.js ~/projects/target-repository
```

If no path is provided, the scripts will throw an error. The repository must contain a `page_classes` directory with JavaScript files.

## Repository Discovery

The scripts use explicit repository specification:

1. **Command-line argument** (required)
2. **Environment variable** - `TARGET_REPOSITORY_PATH`
3. **No fallback behavior** - scripts will error if no valid path is provided

## Git Configuration

The MCP server automatically extracts configuration from the target repository:
- Remote URL parsing for GitHub repository identification
- Current branch detection
- Repository owner and name extraction
- Fallback to default values if Git operations fail

## Authentication

Ensure your GitHub token has the following permissions:
- `repo` (full repository access)
- `workflow` (if working with GitHub Actions)
- `user:email` (for commit attribution)

Create a token at: https://github.com/settings/tokens

## Example Workflow

1. Make changes to your local target repository
2. Run analysis: `node test-mcp-enhanced.js /path/to/target-repository`
3. Review suggested refactoring patterns
4. Create PR: `node test-pr-creation.js /path/to/target-repository`
5. Review the generated pull request on GitHub

## Troubleshooting

- **Repository not found**: Ensure the target repository path exists and contains a `page_classes` directory
- **Authentication errors**: Verify your GitHub token has sufficient permissions
- **Git configuration issues**: Run `git config --list` to verify your Git setup
- **Branch detection fails**: Ensure you're in a Git repository with commits

## Advanced Usage

For more advanced usage patterns, check the individual test scripts and the MCP server source code in the `src/` directory.