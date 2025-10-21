# GitHub MCP Server Workspace Instructions

This workspace is designed for GitHub Model Context Protocol (MCP) Server integration with automated code comparison, refactoring, and pull request creation capabilities.

## Project Purpose
- Compare local file changes with remote repository code
- Analyze code relationships and detect method name/logical changes
- Perform intelligent refactoring based on existing remote patterns
- Create readable pull requests with automated change analysis
- Integrate with GitHub via config YAML and authentication tokens

## Development Guidelines
- Use TypeScript for type safety in MCP server development
- Follow GitHub API best practices for repository interactions
- Implement robust error handling for network operations
- Use semantic analysis for code comparison and refactoring
- Ensure PR descriptions are comprehensive and review-friendly

## Key Components
- MCP Server configuration and handlers
- GitHub API integration layer
- Code analysis and comparison engine
- Automated refactoring logic
- PR creation and management system
- Configuration management with YAML support
- Authentication and token handling

## Coding Standards
- Use proper TypeScript types throughout
- Implement comprehensive logging for debugging
- Follow async/await patterns for API calls
- Use proper error boundaries and fallback mechanisms
- Maintain clean separation between concerns

## MCP SDK References
- TypeScript SDK: https://github.com/modelcontextprotocol/typescript-sdk
- Documentation: https://modelcontextprotocol.io/
- Specification: https://spec.modelcontextprotocol.io/
- Server Examples: https://github.com/modelcontextprotocol/servers