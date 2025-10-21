# GitHub MCP Server

A comprehensive Model Context Protocol (MCP) server for GitHub integration that provides automated code comparison, intelligent refactoring, and enhanced pull request creation capabilities.

## Features

### 🔍 Code Analysis
- **Deep Comparison**: Compare local files with remote repository versions
- **Method Tracking**: Detect renamed and moved methods across refactoring changes
- **Logic Analysis**: Identify changes in program control flow and logic
- **Relationship Mapping**: Understand how code changes relate to existing codebase

### 🔧 Intelligent Refactoring  
- **Pattern Recognition**: Extract and apply coding patterns from remote repositories
- **Automated Refactoring**: Apply consistent naming, formatting, and structural changes
- **Logic Preservation**: Ensure refactoring maintains original program behavior
- **Backup Creation**: Automatically create backups before making changes

### 📝 Enhanced Pull Requests
- **Automated Analysis**: Generate comprehensive change analysis for PRs
- **Readable Descriptions**: Create detailed, review-friendly PR descriptions
- **Change Categorization**: Organize changes by type and significance
- **Review Recommendations**: Provide actionable recommendations for reviewers

## Installation

### Prerequisites
- Node.js 18+ 
- TypeScript 5+
- GitHub Personal Access Token or GitHub App credentials

### Setup

1. **Clone and Install**
   ```bash
   git clone <repository-url>
   cd github-mcp-server
   npm install
   ```

2. **Build the Project**
   ```bash
   npm run build
   ```

3. **Configure Authentication**
   
   Copy the example configuration:
   ```bash
   cp config.example.yml config.yml
   ```
   
   **Option A: Personal Access Token**
   ```yaml
   github:
     auth:
       type: "token"
       token: "ghp_your_github_token_here"
   ```
   
   **Option B: GitHub App**
   ```yaml
   github:
     auth:
       type: "app"
       appId: "123456"
       privateKey: |
         -----BEGIN PRIVATE KEY-----
         Your private key content
         -----END PRIVATE KEY-----
       installationId: "12345678"
   ```

4. **Set Environment Variables** (Optional)
   ```bash
   export GITHUB_TOKEN="your_github_token"
   ```

## Usage

### Running the Server

**Standalone Mode:**
```bash
npm start
```

**Development Mode:**
```bash
npm run dev
```

### MCP Client Integration

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "github-mcp-server": {
      "command": "node",
      "args": ["/path/to/github-mcp-server/build/index.js"]
    }
  }
}
```

## Available Tools

### 1. `compare_with_remote`
Compare local file changes with remote repository content.

**Parameters:**
- `localPath` (string): Path to local file or directory
- `repository` (string): GitHub repository (owner/repo)
- `remoteBranch` (string, optional): Branch to compare against (default: "main")
- `analysisDepth` (enum, optional): Analysis level - "basic", "detailed", "comprehensive"

**Example:**
```javascript
{
  "localPath": "./src/components/Button.tsx",
  "repository": "myorg/myrepo", 
  "remoteBranch": "develop",
  "analysisDepth": "comprehensive"
}
```

### 2. `analyze_code_changes`
Analyze code changes for method renames and logical modifications.

**Parameters:**
- `filePath` (string): File path to analyze
- `repository` (string): GitHub repository (owner/repo)
- `targetBranch` (string, optional): Target branch for comparison
- `includeMethodTracking` (boolean, optional): Track method renames/moves
- `includeLogicAnalysis` (boolean, optional): Analyze logical changes

### 3. `refactor_with_patterns`
Refactor code using patterns extracted from remote repository.

**Parameters:**
- `localPath` (string): Path to refactor
- `repository` (string): Repository for pattern analysis
- `refactoringRules` (array, optional): Specific rules to apply
- `preserveLogic` (boolean, optional): Preserve original logic
- `createBackup` (boolean, optional): Create backup before changes

### 4. `create_analyzed_pr`
Create pull request with comprehensive analysis and descriptions.

**Parameters:**
- `repository` (string): GitHub repository (owner/repo)
- `branchName` (string): Name for the new branch
- `title` (string): Pull request title
- `baseBranch` (string, optional): Base branch for PR
- `includeAnalysis` (boolean, optional): Include change analysis
- `autoDescription` (boolean, optional): Auto-generate description

### 5. `configure_github_auth`
Configure GitHub authentication credentials.

**Parameters:**
- `authType` (enum): "token" or "app"
- `token` (string, optional): GitHub personal access token
- `appId` (string, optional): GitHub App ID
- `privateKey` (string, optional): GitHub App private key
- `installationId` (string, optional): GitHub App installation ID

## Configuration

The server uses a YAML configuration file (`config.yml`) with the following sections:

### GitHub Authentication
```yaml
github:
  auth:
    type: "token"  # or "app"
    token: "your-token"
```

### Analysis Settings
```yaml
analysis:
  defaultDepth: "detailed"
  enableMethodTracking: true
  enableLogicAnalysis: true
```

### Refactoring Options
```yaml
refactoring:
  preserveLogic: true
  createBackups: true
  rules:
    - "consistent-naming"
    - "remove-unused-imports"
    - "organize-imports"
    - "format-code"
```

### Pull Request Settings  
```yaml
pullRequests:
  autoDescription: true
  includeAnalysis: true
  defaultBaseBranch: "main"
```

## Development

### Project Structure
```
src/
├── index.ts                 # Main server entry point
├── services/
│   ├── github.ts           # GitHub API integration
│   ├── codeAnalyzer.ts     # Code analysis engine
│   ├── configManager.ts    # Configuration management
│   ├── pullRequestManager.ts # PR creation and management
│   └── refactoringEngine.ts # Code refactoring logic
└── types/                  # TypeScript type definitions
```

### Scripts
- `npm run build` - Build TypeScript to JavaScript
- `npm run dev` - Development mode with file watching
- `npm test` - Run test suite
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

### Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## Troubleshooting

### Common Issues

**Authentication Errors:**
- Verify GitHub token has necessary permissions
- Check token hasn't expired
- Ensure repository access is granted

**File Access Issues:**
- Verify file paths are correct and accessible
- Check file permissions
- Ensure repository exists and is accessible

**Analysis Failures:**
- Check file encoding (UTF-8 expected)
- Verify file types are supported
- Review error logs for specific issues

### Debug Mode
Enable debug logging by setting environment variable:
```bash
DEBUG=github-mcp-server npm start
```

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- 📖 [Documentation](https://modelcontextprotocol.io/)
- 🐛 [Issue Tracker](https://github.com/your-org/github-mcp-server/issues)
- 💬 [Discussions](https://github.com/your-org/github-mcp-server/discussions)


run to analyse local repo
```bash
node test-mcp-enhanced.js
```