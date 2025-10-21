import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";
import fetch from "node-fetch";

export interface GitHubConfig {
  token?: string;
  appId?: string;
  privateKey?: string;
  installationId?: string;
}

export class GitHubService {
  private octokit?: Octokit;

  async configure(authType: "token" | "app", config: GitHubConfig) {
    if (authType === "token" && config.token) {
      this.octokit = new Octokit({
        auth: config.token,
        request: {
          fetch: fetch as any
        }
      });
    } else if (authType === "app" && config.appId && config.privateKey && config.installationId) {
      this.octokit = new Octokit({
        authStrategy: createAppAuth,
        auth: {
          appId: config.appId,
          privateKey: config.privateKey,
          installationId: config.installationId
        },
        request: {
          fetch: fetch as any
        }
      });
    } else {
      throw new Error("Invalid authentication configuration");
    }
  }

  async getFileContent(repository: string, path: string, branch: string = "main"): Promise<string> {
    if (!this.octokit) {
      throw new Error("GitHub client not configured");
    }

    const [owner, repo] = repository.split("/");
    
    try {
      const response = await this.octokit.rest.repos.getContent({
        owner,
        repo,
        path,
        ref: branch
      });

      if (Array.isArray(response.data)) {
        throw new Error("Path points to a directory, not a file");
      }

      if (response.data.type !== "file") {
        throw new Error("Path does not point to a file");
      }

      return Buffer.from(response.data.content, "base64").toString("utf-8");
    } catch (error) {
      throw new Error(`Failed to get file content: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async createBranch(repository: string, branchName: string, baseBranch: string = "main"): Promise<void> {
    if (!this.octokit) {
      throw new Error("GitHub client not configured");
    }

    const [owner, repo] = repository.split("/");
    
    // Get the base branch SHA
    const baseBranchResponse = await this.octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${baseBranch}`
    });

    // Create new branch
    await this.octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: baseBranchResponse.data.object.sha
    });
  }

  async commitFiles(repository: string, branch: string, files: Array<{path: string, content: string}>, message: string): Promise<void> {
    if (!this.octokit) {
      throw new Error("GitHub client not configured");
    }

    const [owner, repo] = repository.split("/");
    
    for (const file of files) {
      try {
        // First, try to get the existing file to get its SHA
        let sha: string | undefined;
        
        try {
          const existingFile = await this.octokit.rest.repos.getContent({
            owner,
            repo,
            path: file.path,
            ref: branch
          });
          
          // If it's a file (not array), get the SHA
          if (!Array.isArray(existingFile.data) && existingFile.data.type === "file") {
            sha = existingFile.data.sha;
          }
        } catch (error: any) {
          // File doesn't exist, which is fine for new files
          if (error.status !== 404) {
            throw error;
          }
        }
        
        // Commit the file with SHA if it exists
        const commitData: any = {
          owner,
          repo,
          path: file.path,
          message,
          content: Buffer.from(file.content).toString("base64"),
          branch
        };
        
        if (sha) {
          commitData.sha = sha;
        }
        
        await this.octokit.rest.repos.createOrUpdateFileContents(commitData);
        
      } catch (error) {
        console.error(`Failed to commit file ${file.path}:`, error);
        throw error;
      }
    }
  }

  async createPullRequest(repository: string, options: {
    title: string;
    head: string;
    base: string;
    body: string;
  }): Promise<{number: number, url: string}> {
    if (!this.octokit) {
      throw new Error("GitHub client not configured");
    }

    const [owner, repo] = repository.split("/");
    
    const response = await this.octokit.rest.pulls.create({
      owner,
      repo,
      title: options.title,
      head: options.head,
      base: options.base,
      body: options.body
    });

    return {
      number: response.data.number,
      url: response.data.html_url
    };
  }

  async getRepositoryStructure(repository: string, path: string = "", branch: string = "main"): Promise<any[]> {
    if (!this.octokit) {
      throw new Error("GitHub client not configured");
    }

    const [owner, repo] = repository.split("/");
    
    const response = await this.octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ref: branch
    });

    return Array.isArray(response.data) ? response.data : [response.data];
  }

  async compareCommits(repository: string, base: string, head: string): Promise<any> {
    if (!this.octokit) {
      throw new Error("GitHub client not configured");
    }

    const [owner, repo] = repository.split("/");
    
    const response = await this.octokit.rest.repos.compareCommits({
      owner,
      repo,
      base,
      head
    });

    return response.data;
  }
}