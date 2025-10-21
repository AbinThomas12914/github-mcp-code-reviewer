import * as fs from "fs/promises";
import * as path from "path";
import * as yaml from "yaml";

export interface ServerConfig {
  github: {
    auth: {
      type: "token" | "app";
      token?: string;
      appId?: string;
      privateKey?: string;
      installationId?: string;
    };
  };
  analysis: {
    defaultDepth: "basic" | "detailed" | "comprehensive";
    enableMethodTracking: boolean;
    enableLogicAnalysis: boolean;
  };
  refactoring: {
    preserveLogic: boolean;
    createBackups: boolean;
    rules: string[];
  };
  pullRequests: {
    autoDescription: boolean;
    includeAnalysis: boolean;
    defaultBaseBranch: string;
  };
}

export class ConfigManager {
  private configPath: string;
  private config?: ServerConfig;

  constructor(configPath?: string) {
    this.configPath = configPath || path.join(process.cwd(), "config.yml");
  }

  async loadConfig(): Promise<ServerConfig> {
    if (this.config) {
      return this.config;
    }

    try {
      const configContent = await fs.readFile(this.configPath, "utf-8");
      this.config = yaml.parse(configContent) as ServerConfig;
      
      // Validate config structure
      this.validateConfig(this.config);
      
      return this.config;
    } catch (error) {
      if ((error as any).code === "ENOENT") {
        // Create default config if none exists
        this.config = this.getDefaultConfig();
        await this.saveConfig(this.config);
        return this.config;
      }
      throw new Error(`Failed to load config: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async saveConfig(config: ServerConfig): Promise<void> {
    try {
      const configYaml = yaml.stringify(config, { indent: 2 });
      await fs.writeFile(this.configPath, configYaml, "utf-8");
      this.config = config;
    } catch (error) {
      throw new Error(`Failed to save config: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async updateConfig(updates: Partial<ServerConfig>): Promise<void> {
    const currentConfig = await this.loadConfig();
    const updatedConfig = this.mergeDeep(currentConfig, updates);
    await this.saveConfig(updatedConfig);
  }

  getConfigPath(): string {
    return this.configPath;
  }

  private getDefaultConfig(): ServerConfig {
    return {
      github: {
        auth: {
          type: "token",
          token: (typeof process !== "undefined" && process.env.GITHUB_TOKEN) ? process.env.GITHUB_TOKEN : ""
        }
      },
      analysis: {
        defaultDepth: "detailed",
        enableMethodTracking: true,
        enableLogicAnalysis: true
      },
      refactoring: {
        preserveLogic: true,
        createBackups: true,
        rules: [
          "consistent-naming",
          "remove-unused-imports",
          "format-code"
        ]
      },
      pullRequests: {
        autoDescription: true,
        includeAnalysis: true,
        defaultBaseBranch: "main"
      }
    };
  }

  private validateConfig(config: any): void {
    if (!config.github || !config.github.auth) {
      throw new Error("GitHub authentication configuration is required");
    }

    if (config.github.auth.type === "token" && !config.github.auth.token && !process.env.GITHUB_TOKEN) {
      throw new Error("GitHub token is required when using token authentication");
    }

    if (config.github.auth.type === "app") {
      if (!config.github.auth.appId || !config.github.auth.privateKey || !config.github.auth.installationId) {
        throw new Error("App ID, private key, and installation ID are required for GitHub App authentication");
      }
    }
  }

  private mergeDeep(target: any, source: any): any {
    const output = Object.assign({}, target);
    
    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach(key => {
        if (this.isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = this.mergeDeep(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }
    
    return output;
  }

  private isObject(item: any): boolean {
    return item && typeof item === "object" && !Array.isArray(item);
  }
}