import * as fs from "fs/promises";
import * as path from "path";
import { diffLines } from "diff";
import { Project } from "ts-morph";

export interface ComparisonResult {
  changes: ChangeInfo[];
  relationships: RelationshipInfo[];
  recommendations: string[];
  metrics: AnalysisMetrics;
}

export interface ChangeInfo {
  type: "added" | "removed" | "modified";
  lineNumber: number;
  content: string;
  significance: "low" | "medium" | "high";
}

export interface RelationshipInfo {
  type: "method_rename" | "method_move" | "logic_change" | "dependency_change";
  oldReference: string;
  newReference: string;
  confidence: number;
  description: string;
}

export interface AnalysisMetrics {
  totalChanges: number;
  significantChanges: number;
  complexityScore: number;
  maintainabilityImpact: "low" | "medium" | "high";
}

export interface AnalysisOptions {
  methodTracking?: boolean;
  logicAnalysis?: boolean;
}

export class CodeAnalyzer {
  private project: Project;

  constructor() {
    this.project = new Project({
      useInMemoryFileSystem: true,
      compilerOptions: {
        target: 99, // Latest
        module: 1, // CommonJS
        allowJs: true,
        checkJs: false
      }
    });
  }

  async compareFiles(
    localPath: string,
    remoteContent: string,
    depth: "basic" | "detailed" | "comprehensive" = "detailed"
  ): Promise<ComparisonResult> {
    try {
      const localContent = await fs.readFile(localPath, "utf-8");
      const diff = diffLines(remoteContent, localContent);
      
      const changes: ChangeInfo[] = [];
      let lineNumber = 0;

      for (const part of diff) {
        if (part.added) {
          const lines = part.value.split("\n");
          for (const line of lines) {
            if (line.trim()) {
              changes.push({
                type: "added",
                lineNumber: lineNumber++,
                content: line,
                significance: this.assessSignificance(line)
              });
            }
          }
        } else if (part.removed) {
          const lines = part.value.split("\n");
          for (const line of lines) {
            if (line.trim()) {
              changes.push({
                type: "removed",
                lineNumber: lineNumber++,
                content: line,
                significance: this.assessSignificance(line)
              });
            }
          }
        } else {
          lineNumber += part.value.split("\n").length - 1;
        }
      }

      let relationships: RelationshipInfo[] = [];
      if (depth === "detailed" || depth === "comprehensive") {
        relationships = await this.analyzeRelationships(localContent, remoteContent);
      }

      const metrics = this.calculateMetrics(changes, relationships);
      const recommendations = this.generateRecommendations(changes, relationships, metrics);

      return {
        changes,
        relationships,
        recommendations,
        metrics
      };
    } catch (error) {
      throw new Error(`Failed to analyze files: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async analyzeChanges(
    filePath: string,
    remoteContent: string,
    options: AnalysisOptions = {}
  ): Promise<{
    methodChanges: RelationshipInfo[];
    logicChanges: RelationshipInfo[];
    summary: string;
  }> {
    const localContent = await fs.readFile(filePath, "utf-8");
    const fileExtension = path.extname(filePath);
    
    let methodChanges: RelationshipInfo[] = [];
    let logicChanges: RelationshipInfo[] = [];

    if (options.methodTracking && this.isCodeFile(fileExtension)) {
      methodChanges = await this.trackMethodChanges(localContent, remoteContent, fileExtension);
    }

    if (options.logicAnalysis && this.isCodeFile(fileExtension)) {
      logicChanges = await this.analyzeLogicChanges(localContent, remoteContent, fileExtension);
    }

    const summary = this.generateChangeSummary(methodChanges, logicChanges);

    return {
      methodChanges,
      logicChanges,
      summary
    };
  }

  async extractPatterns(repository: string): Promise<{
    namingPatterns: string[];
    structuralPatterns: string[];
    codingStyles: string[];
  }> {
    // This would typically analyze the repository structure and code patterns
    // For now, returning common patterns
    return {
      namingPatterns: [
        "camelCase for variables and functions",
        "PascalCase for classes and types",
        "UPPER_SNAKE_CASE for constants"
      ],
      structuralPatterns: [
        "Import statements at top of file",
        "Type definitions before implementations",
        "Export statements at end of file"
      ],
      codingStyles: [
        "Use explicit types",
        "Prefer const over let",
        "Use arrow functions for callbacks"
      ]
    };
  }

  private assessSignificance(line: string): "low" | "medium" | "high" {
    const trimmedLine = line.trim();
    
    // High significance indicators
    if (trimmedLine.includes("export") || 
        trimmedLine.includes("import") ||
        trimmedLine.includes("class") ||
        trimmedLine.includes("function") ||
        trimmedLine.includes("interface") ||
        trimmedLine.includes("type")) {
      return "high";
    }

    // Medium significance indicators
    if (trimmedLine.includes("const") ||
        trimmedLine.includes("let") ||
        trimmedLine.includes("var") ||
        trimmedLine.includes("return") ||
        trimmedLine.includes("throw")) {
      return "medium";
    }

    // Comments and whitespace are low significance
    if (trimmedLine.startsWith("//") || 
        trimmedLine.startsWith("/*") ||
        trimmedLine === "") {
      return "low";
    }

    return "medium";
  }

  private async analyzeRelationships(
    localContent: string,
    remoteContent: string
  ): Promise<RelationshipInfo[]> {
    const relationships: RelationshipInfo[] = [];
    
    // Simple pattern matching for method renames
    const localMethods = this.extractMethods(localContent);
    const remoteMethods = this.extractMethods(remoteContent);
    
    for (const localMethod of localMethods) {
      let bestMatch = null;
      let bestConfidence = 0;
      
      for (const remoteMethod of remoteMethods) {
        const confidence = this.calculateMethodSimilarity(localMethod, remoteMethod);
        if (confidence > bestConfidence && confidence > 0.7) {
          bestConfidence = confidence;
          bestMatch = remoteMethod;
        }
      }
      
      if (bestMatch && bestMatch !== localMethod) {
        relationships.push({
          type: "method_rename",
          oldReference: bestMatch,
          newReference: localMethod,
          confidence: bestConfidence,
          description: `Method '${bestMatch}' appears to be renamed to '${localMethod}'`
        });
      }
    }
    
    return relationships;
  }

  private extractMethods(content: string): string[] {
    const methods: string[] = [];
    const lines = content.split("\n");
    
    for (const line of lines) {
      const functionMatch = line.match(/(?:function\s+|const\s+|let\s+|var\s+)(\w+)/);
      const methodMatch = line.match(/(\w+)\s*\(/);
      
      if (functionMatch) {
        methods.push(functionMatch[1]);
      } else if (methodMatch && !line.includes("if") && !line.includes("for") && !line.includes("while")) {
        methods.push(methodMatch[1]);
      }
    }
    
    return methods;
  }

  private calculateMethodSimilarity(method1: string, method2: string): number {
    if (method1 === method2) return 1.0;
    
    // Simple string similarity - could be enhanced with more sophisticated algorithms
    const longer = method1.length > method2.length ? method1 : method2;
    const shorter = method1.length > method2.length ? method2 : method1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private calculateMetrics(
    changes: ChangeInfo[],
    relationships: RelationshipInfo[]
  ): AnalysisMetrics {
    const totalChanges = changes.length;
    const significantChanges = changes.filter(c => c.significance === "high").length;
    const complexityScore = this.calculateComplexityScore(changes, relationships);
    const maintainabilityImpact = this.assessMaintainabilityImpact(complexityScore, significantChanges);
    
    return {
      totalChanges,
      significantChanges,
      complexityScore,
      maintainabilityImpact
    };
  }

  private calculateComplexityScore(
    changes: ChangeInfo[],
    relationships: RelationshipInfo[]
  ): number {
    let score = 0;
    
    // Base score from changes
    score += changes.length * 0.1;
    
    // Higher weight for significant changes
    score += changes.filter(c => c.significance === "high").length * 0.5;
    
    // Add complexity for relationships
    score += relationships.length * 0.3;
    
    // Normalize to 0-10 scale
    return Math.min(score, 10);
  }

  private assessMaintainabilityImpact(
    complexityScore: number,
    significantChanges: number
  ): "low" | "medium" | "high" {
    if (complexityScore < 3 && significantChanges < 5) return "low";
    if (complexityScore < 7 && significantChanges < 15) return "medium";
    return "high";
  }

  private generateRecommendations(
    changes: ChangeInfo[],
    relationships: RelationshipInfo[],
    metrics: AnalysisMetrics
  ): string[] {
    const recommendations: string[] = [];
    
    if (metrics.maintainabilityImpact === "high") {
      recommendations.push("Consider breaking this change into smaller, more focused commits");
    }
    
    if (relationships.some(r => r.type === "method_rename")) {
      recommendations.push("Update documentation and comments to reflect method renames");
    }
    
    if (changes.filter(c => c.type === "removed").length > changes.filter(c => c.type === "added").length) {
      recommendations.push("Verify that removed functionality is intentional and properly handled");
    }
    
    if (metrics.complexityScore > 7) {
      recommendations.push("Consider adding unit tests to cover the complex changes");
    }
    
    return recommendations;
  }

  private async trackMethodChanges(
    localContent: string,
    remoteContent: string,
    fileExtension: string
  ): Promise<RelationshipInfo[]> {
    // Enhanced method tracking using AST analysis
    return this.analyzeRelationships(localContent, remoteContent);
  }

  private async analyzeLogicChanges(
    localContent: string,
    remoteContent: string,
    fileExtension: string
  ): Promise<RelationshipInfo[]> {
    const changes: RelationshipInfo[] = [];
    
    // Analyze control flow changes
    const localControlFlow = this.extractControlFlow(localContent);
    const remoteControlFlow = this.extractControlFlow(remoteContent);
    
    const controlFlowDiff = this.compareArrays(localControlFlow, remoteControlFlow);
    
    for (const diff of controlFlowDiff) {
      changes.push({
        type: "logic_change",
        oldReference: diff.old || "none",
        newReference: diff.new || "none",
        confidence: 0.9,
        description: `Control flow change: ${diff.description}`
      });
    }
    
    return changes;
  }

  private extractControlFlow(content: string): string[] {
    const controlFlowKeywords = ['if', 'else', 'for', 'while', 'switch', 'case', 'try', 'catch'];
    const lines = content.split('\n');
    const controlFlow: string[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      for (const keyword of controlFlowKeywords) {
        if (trimmed.includes(keyword)) {
          controlFlow.push(trimmed);
          break;
        }
      }
    }
    
    return controlFlow;
  }

  private compareArrays(arr1: string[], arr2: string[]): Array<{old?: string, new?: string, description: string}> {
    const diffs: Array<{old?: string, new?: string, description: string}> = [];
    
    // Simple diff - could be enhanced
    const maxLength = Math.max(arr1.length, arr2.length);
    
    for (let i = 0; i < maxLength; i++) {
      if (i >= arr1.length) {
        diffs.push({
          new: arr2[i],
          description: `Added control flow: ${arr2[i]}`
        });
      } else if (i >= arr2.length) {
        diffs.push({
          old: arr1[i],
          description: `Removed control flow: ${arr1[i]}`
        });
      } else if (arr1[i] !== arr2[i]) {
        diffs.push({
          old: arr1[i],
          new: arr2[i],
          description: `Modified control flow: ${arr1[i]} -> ${arr2[i]}`
        });
      }
    }
    
    return diffs;
  }

  private isCodeFile(extension: string): boolean {
    const codeExtensions = ['.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.cpp', '.c', '.cs', '.go', '.rs'];
    return codeExtensions.includes(extension.toLowerCase());
  }

  private generateChangeSummary(
    methodChanges: RelationshipInfo[],
    logicChanges: RelationshipInfo[]
  ): string {
    const totalChanges = methodChanges.length + logicChanges.length;
    
    if (totalChanges === 0) {
      return "No significant method or logic changes detected.";
    }
    
    let summary = `Found ${totalChanges} significant change(s):\n`;
    
    if (methodChanges.length > 0) {
      summary += `- ${methodChanges.length} method-related change(s)\n`;
    }
    
    if (logicChanges.length > 0) {
      summary += `- ${logicChanges.length} logic change(s)\n`;
    }
    
    return summary;
  }
}