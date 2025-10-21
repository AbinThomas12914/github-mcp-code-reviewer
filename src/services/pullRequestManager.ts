import { GitHubService } from "./github.js";
import { CodeAnalyzer, ComparisonResult } from "./codeAnalyzer.js";

export interface PROptions {
  repository: string;
  branchName: string;
  title: string;
  baseBranch: string;
  includeAnalysis: boolean;
  autoDescription: boolean;
}

export interface PRResult {
  pr: {
    number: number;
    url: string;
  };
  analysis?: ComparisonResult;
  url: string;
}

export class PullRequestManager {
  private github: GitHubService;
  private analyzer?: CodeAnalyzer;

  constructor(github: GitHubService, analyzer?: CodeAnalyzer) {
    this.github = github;
    this.analyzer = analyzer;
  }

  async createAnalyzedPR(options: PROptions): Promise<PRResult> {
    const {
      repository,
      branchName,
      title,
      baseBranch,
      includeAnalysis,
      autoDescription
    } = options;

    try {
      // Create branch if it doesn't exist
      await this.github.createBranch(repository, branchName, baseBranch);

      let analysis: ComparisonResult | undefined;
      let description = "Automated pull request created by GitHub MCP Server";

      if (includeAnalysis && this.analyzer) {
        // Get changed files and analyze them
        const changedFiles = await this.getChangedFiles(repository, branchName, baseBranch);
        
        if (changedFiles.length > 0) {
          // Analyze the first changed file as an example
          // In a real implementation, you'd analyze all files
          const firstFile = changedFiles[0];
          const remoteContent = await this.github.getFileContent(repository, firstFile.path, baseBranch);
          
          analysis = await this.analyzer.compareFiles(
            firstFile.path,
            remoteContent,
            "detailed"
          );
        }
      }

      if (autoDescription && analysis) {
        description = this.generatePRDescription(analysis);
      }

      const pr = await this.github.createPullRequest(repository, {
        title,
        head: branchName,
        base: baseBranch,
        body: description
      });

      return {
        pr,
        analysis,
        url: pr.url
      };
    } catch (error) {
      throw new Error(`Failed to create analyzed PR: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async getChangedFiles(
    repository: string,
    head: string,
    base: string
  ): Promise<Array<{path: string, status: string}>> {
    try {
      const comparison = await this.github.compareCommits(repository, base, head);
      
      return comparison.files?.map((file: any) => ({
        path: file.filename,
        status: file.status
      })) || [];
    } catch (error) {
      // If comparison fails, return empty array
      console.error("Failed to get changed files:", error);
      return [];
    }
  }

  private generatePRDescription(analysis: ComparisonResult): string {
    let description = "## 📊 Automated Analysis\n\n";

    // Summary section
    description += "### Summary\n";
    description += `- **Total Changes:** ${analysis.metrics.totalChanges}\n`;
    description += `- **Significant Changes:** ${analysis.metrics.significantChanges}\n`;
    description += `- **Complexity Score:** ${analysis.metrics.complexityScore.toFixed(1)}/10\n`;
    description += `- **Maintainability Impact:** ${analysis.metrics.maintainabilityImpact}\n\n`;

    // Changes breakdown
    if (analysis.changes.length > 0) {
      description += "### 🔄 Changes Detected\n\n";
      
      const addedChanges = analysis.changes.filter(c => c.type === "added");
      const removedChanges = analysis.changes.filter(c => c.type === "removed");
      const modifiedChanges = analysis.changes.filter(c => c.type === "modified");

      if (addedChanges.length > 0) {
        description += `**Added (${addedChanges.length}):**\n`;
        addedChanges.slice(0, 5).forEach(change => {
          description += `- Line ${change.lineNumber}: ${change.content.trim()}\n`;
        });
        if (addedChanges.length > 5) {
          description += `- ... and ${addedChanges.length - 5} more additions\n`;
        }
        description += "\n";
      }

      if (removedChanges.length > 0) {
        description += `**Removed (${removedChanges.length}):**\n`;
        removedChanges.slice(0, 5).forEach(change => {
          description += `- Line ${change.lineNumber}: ${change.content.trim()}\n`;
        });
        if (removedChanges.length > 5) {
          description += `- ... and ${removedChanges.length - 5} more removals\n`;
        }
        description += "\n";
      }
    }

    // Relationships section
    if (analysis.relationships.length > 0) {
      description += "### 🔗 Code Relationships\n\n";
      
      analysis.relationships.forEach(rel => {
        const confidencePercent = Math.round(rel.confidence * 100);
        description += `- **${rel.type}** (${confidencePercent}% confidence): ${rel.description}\n`;
      });
      description += "\n";
    }

    // Recommendations section
    if (analysis.recommendations.length > 0) {
      description += "### 💡 Recommendations\n\n";
      
      analysis.recommendations.forEach(rec => {
        description += `- ${rec}\n`;
      });
      description += "\n";
    }

    // Review checklist
    description += "### ✅ Review Checklist\n\n";
    description += "- [ ] Code changes have been reviewed for correctness\n";
    description += "- [ ] Tests have been added or updated as needed\n";
    description += "- [ ] Documentation has been updated if necessary\n";
    
    if (analysis.relationships.some(r => r.type === "method_rename")) {
      description += "- [ ] Method renames have been verified across the codebase\n";
    }
    
    if (analysis.metrics.maintainabilityImpact === "high") {
      description += "- [ ] High-impact changes have been thoroughly tested\n";
    }

    description += "\n---\n";
    description += "*This description was automatically generated by GitHub MCP Server*";

    return description;
  }

  async updatePRDescription(
    repository: string,
    prNumber: number,
    newDescription: string
  ): Promise<void> {
    // This would require additional GitHub API methods
    // For now, we'll throw an error indicating it's not implemented
    throw new Error("Update PR description functionality not yet implemented");
  }

  async addPRComment(
    repository: string,
    prNumber: number,
    comment: string
  ): Promise<void> {
    // This would require additional GitHub API methods
    // For now, we'll throw an error indicating it's not implemented
    throw new Error("Add PR comment functionality not yet implemented");
  }
}