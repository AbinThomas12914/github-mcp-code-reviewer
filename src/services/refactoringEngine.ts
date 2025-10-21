import * as fs from "fs/promises";
import * as path from "path";
import { CodeAnalyzer } from "./codeAnalyzer.js";

export interface RefactoringOptions {
  rules?: string[];
  preserveLogic: boolean;
  createBackup: boolean;
}

export interface RefactoringResult {
  files: string[];
  changes: RefactoringChange[];
  backupPath?: string;
}

export interface RefactoringChange {
  file: string;
  type: "rename" | "format" | "import" | "structure";
  description: string;
  lineNumbers: number[];
}

export interface CodePatterns {
  namingPatterns: string[];
  structuralPatterns: string[];
  codingStyles: string[];
}

export class RefactoringEngine {
  private analyzer: CodeAnalyzer;

  constructor(analyzer: CodeAnalyzer) {
    this.analyzer = analyzer;
  }

  async refactorCode(
    targetPath: string,
    patterns: CodePatterns,
    options: RefactoringOptions
  ): Promise<RefactoringResult> {
    const changes: RefactoringChange[] = [];
    const processedFiles: string[] = [];
    let backupPath: string | undefined;

    try {
      // Create backup if requested
      if (options.createBackup) {
        backupPath = await this.createBackup(targetPath);
      }

      // Determine if targetPath is a file or directory
      const stats = await fs.stat(targetPath);
      const filesToProcess: string[] = [];

      if (stats.isDirectory()) {
        filesToProcess.push(...await this.getCodeFiles(targetPath));
      } else {
        filesToProcess.push(targetPath);
      }

      // Process each file
      for (const filePath of filesToProcess) {
        const fileChanges = await this.refactorFile(filePath, patterns, options);
        changes.push(...fileChanges);
        
        if (fileChanges.length > 0) {
          processedFiles.push(filePath);
        }
      }

      return {
        files: processedFiles,
        changes,
        backupPath
      };
    } catch (error) {
      throw new Error(`Refactoring failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async refactorFile(
    filePath: string,
    patterns: CodePatterns,
    options: RefactoringOptions
  ): Promise<RefactoringChange[]> {
    const content = await fs.readFile(filePath, "utf-8");
    const lines = content.split("\n");
    const changes: RefactoringChange[] = [];
    let modifiedContent = content;
    let hasChanges = false;

    // Apply refactoring rules
    const rulesToApply = options.rules || this.getDefaultRules();

    for (const rule of rulesToApply) {
      const ruleChanges = await this.applyRule(rule, filePath, modifiedContent, patterns);
      
      if (ruleChanges.modifiedContent !== modifiedContent) {
        modifiedContent = ruleChanges.modifiedContent;
        changes.push(...ruleChanges.changes);
        hasChanges = true;
      }
    }

    // Write back the modified content if there are changes
    if (hasChanges && options.preserveLogic) {
      // Verify that logic is preserved before writing
      const logicPreserved = await this.verifyLogicPreservation(content, modifiedContent, filePath);
      
      if (logicPreserved) {
        await fs.writeFile(filePath, modifiedContent, "utf-8");
      } else {
        throw new Error(`Logic verification failed for ${filePath}. Refactoring aborted.`);
      }
    } else if (hasChanges) {
      await fs.writeFile(filePath, modifiedContent, "utf-8");
    }

    return changes;
  }

  private async applyRule(
    rule: string,
    filePath: string,
    content: string,
    patterns: CodePatterns
  ): Promise<{modifiedContent: string, changes: RefactoringChange[]}> {
    let modifiedContent = content;
    const changes: RefactoringChange[] = [];

    switch (rule) {
      case "consistent-naming":
        const namingResult = this.applyNamingPatterns(content, patterns.namingPatterns);
        modifiedContent = namingResult.content;
        if (namingResult.changes.length > 0) {
          changes.push({
            file: filePath,
            type: "rename",
            description: "Applied consistent naming patterns",
            lineNumbers: namingResult.changes
          });
        }
        break;

      case "remove-unused-imports":
        const importResult = this.removeUnusedImports(content);
        modifiedContent = importResult.content;
        if (importResult.removedLines.length > 0) {
          changes.push({
            file: filePath,
            type: "import",
            description: "Removed unused imports",
            lineNumbers: importResult.removedLines
          });
        }
        break;

      case "format-code":
        const formatResult = this.formatCode(content, patterns.codingStyles);
        modifiedContent = formatResult.content;
        if (formatResult.changedLines.length > 0) {
          changes.push({
            file: filePath,
            type: "format",
            description: "Applied code formatting",
            lineNumbers: formatResult.changedLines
          });
        }
        break;

      case "organize-imports":
        const organizeResult = this.organizeImports(content);
        modifiedContent = organizeResult.content;
        if (organizeResult.changed) {
          changes.push({
            file: filePath,
            type: "import",
            description: "Organized imports",
            lineNumbers: [1] // Imports are typically at the top
          });
        }
        break;
    }

    return { modifiedContent, changes };
  }

  private applyNamingPatterns(
    content: string,
    namingPatterns: string[]
  ): { content: string, changes: number[] } {
    let modifiedContent = content;
    const changedLines: number[] = [];
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let modifiedLine = line;

      // Apply camelCase for variables and functions
      if (namingPatterns.includes("camelCase for variables and functions")) {
        const variableRegex = /\b(?:const|let|var|function)\s+([a-z_]+[A-Z_][a-zA-Z0-9_]*)\b/g;
        modifiedLine = modifiedLine.replace(variableRegex, (match, name) => {
          const camelCaseName = this.toCamelCase(name);
          if (camelCaseName !== name) {
            changedLines.push(i + 1);
            return match.replace(name, camelCaseName);
          }
          return match;
        });
      }

      // Apply PascalCase for classes and types
      if (namingPatterns.includes("PascalCase for classes and types")) {
        const classRegex = /\b(?:class|interface|type)\s+([a-z][a-zA-Z0-9_]*)\b/g;
        modifiedLine = modifiedLine.replace(classRegex, (match, name) => {
          const pascalCaseName = this.toPascalCase(name);
          if (pascalCaseName !== name) {
            changedLines.push(i + 1);
            return match.replace(name, pascalCaseName);
          }
          return match;
        });
      }

      lines[i] = modifiedLine;
    }

    return {
      content: lines.join("\n"),
      changes: [...new Set(changedLines)] // Remove duplicates
    };
  }

  private removeUnusedImports(content: string): { content: string, removedLines: number[] } {
    const lines = content.split("\n");
    const removedLines: number[] = [];
    const imports: { line: number, imports: string[] }[] = [];
    const usedIdentifiers = new Set<string>();

    // Find all imports
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const importMatch = line.match(/import\s+(?:\{([^}]+)\}|(\w+))\s+from/);
      
      if (importMatch) {
        const importedItems = importMatch[1] 
          ? importMatch[1].split(",").map(item => item.trim())
          : [importMatch[2]];
        
        imports.push({ line: i, imports: importedItems });
      }
    }

    // Find used identifiers in the code
    for (const line of lines) {
      for (const importGroup of imports) {
        for (const importedItem of importGroup.imports) {
          if (line.includes(importedItem) && !line.startsWith("import")) {
            usedIdentifiers.add(importedItem);
          }
        }
      }
    }

    // Mark unused imports for removal
    const filteredLines = lines.filter((line, index) => {
      const importMatch = line.match(/import\s+(?:\{([^}]+)\}|(\w+))\s+from/);
      
      if (importMatch) {
        const importedItems = importMatch[1] 
          ? importMatch[1].split(",").map(item => item.trim())
          : [importMatch[2]];
        
        const hasUsedImports = importedItems.some(item => usedIdentifiers.has(item));
        
        if (!hasUsedImports) {
          removedLines.push(index + 1);
          return false; // Remove this line
        }
      }
      
      return true; // Keep this line
    });

    return {
      content: filteredLines.join("\n"),
      removedLines
    };
  }

  private formatCode(
    content: string,
    codingStyles: string[]
  ): { content: string, changedLines: number[] } {
    const lines = content.split("\n");
    const changedLines: number[] = [];

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      const originalLine = line;

      // Apply coding styles
      for (const style of codingStyles) {
        switch (style) {
          case "Use explicit types":
            // Convert `let x =` to `let x: type =` where appropriate
            if (line.includes("let") && !line.includes(":") && line.includes("=")) {
              // This is a simplified example - real implementation would be more sophisticated
              line = line.replace(/let\s+(\w+)\s*=\s*"/, 'let $1: string = "');
              line = line.replace(/let\s+(\w+)\s*=\s*\d+/, 'let $1: number = ');
            }
            break;

          case "Prefer const over let":
            // Convert `let` to `const` where the variable is not reassigned
            if (line.includes("let ") && !this.isVariableReassigned(lines, i)) {
              line = line.replace(/\blet\b/, "const");
            }
            break;

          case "Use arrow functions for callbacks":
            // Convert function expressions to arrow functions in callbacks
            if (line.includes("function(") || line.includes("function (")) {
              line = line.replace(/function\s*\(([^)]*)\)\s*\{/, "($1) => {");
            }
            break;
        }
      }

      if (line !== originalLine) {
        changedLines.push(i + 1);
        lines[i] = line;
      }
    }

    return {
      content: lines.join("\n"),
      changedLines
    };
  }

  private organizeImports(content: string): { content: string, changed: boolean } {
    const lines = content.split("\n");
    const imports: string[] = [];
    const otherLines: string[] = [];
    let inImportSection = true;

    for (const line of lines) {
      if (line.trim().startsWith("import ")) {
        imports.push(line);
      } else if (line.trim() === "" && inImportSection) {
        // Keep empty lines in import section
        continue;
      } else {
        inImportSection = false;
        otherLines.push(line);
      }
    }

    // Sort imports alphabetically
    const sortedImports = imports.sort();
    const originalImportsString = imports.join("\n");
    const sortedImportsString = sortedImports.join("\n");

    const newContent = [
      ...sortedImports,
      "",
      ...otherLines
    ].join("\n");

    return {
      content: newContent,
      changed: originalImportsString !== sortedImportsString
    };
  }

  private async createBackup(targetPath: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = `${targetPath}.backup.${timestamp}`;
    
    const stats = await fs.stat(targetPath);
    
    if (stats.isDirectory()) {
      // For directories, create a compressed backup (simplified)
      // In a real implementation, you might use tar or zip
      await this.copyDirectory(targetPath, backupPath);
    } else {
      await fs.copyFile(targetPath, backupPath);
    }
    
    return backupPath;
  }

  private async copyDirectory(source: string, destination: string): Promise<void> {
    await fs.mkdir(destination, { recursive: true });
    const entries = await fs.readdir(source, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(source, entry.name);
      const destPath = path.join(destination, entry.name);
      
      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  private async getCodeFiles(directoryPath: string): Promise<string[]> {
    const codeExtensions = [".ts", ".js", ".tsx", ".jsx", ".py", ".java", ".cpp", ".c", ".cs", ".go", ".rs"];
    const codeFiles: string[] = [];
    
    async function scanDirectory(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== ".git") {
          await scanDirectory(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (codeExtensions.includes(ext)) {
            codeFiles.push(fullPath);
          }
        }
      }
    }
    
    await scanDirectory(directoryPath);
    return codeFiles;
  }

  private async verifyLogicPreservation(
    originalContent: string,
    modifiedContent: string,
    filePath: string
  ): Promise<boolean> {
    // This is a simplified logic preservation check
    // In a real implementation, you might:
    // 1. Parse both versions into ASTs
    // 2. Compare semantic structure
    // 3. Run tests if available
    // 4. Check for syntax errors
    
    // Basic checks
    const originalLines = originalContent.split("\n").filter(line => line.trim());
    const modifiedLines = modifiedContent.split("\n").filter(line => line.trim());
    
    // Check if the number of logical lines is roughly the same
    const lineDifference = Math.abs(originalLines.length - modifiedLines.length);
    if (lineDifference > originalLines.length * 0.1) {
      return false; // More than 10% difference in logical lines
    }
    
    // Check for syntax errors (very basic)
    try {
      // This is language-specific and would need proper parsing
      const ext = path.extname(filePath);
      if (ext === ".js" || ext === ".ts") {
        // Basic syntax check - look for unmatched braces
        const openBraces = (modifiedContent.match(/\{/g) || []).length;
        const closeBraces = (modifiedContent.match(/\}/g) || []).length;
        if (openBraces !== closeBraces) {
          return false;
        }
      }
    } catch (error) {
      return false;
    }
    
    return true; // Assume logic is preserved if basic checks pass
  }

  private toCamelCase(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
              .replace(/^[A-Z]/, letter => letter.toLowerCase());
  }

  private toPascalCase(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
              .replace(/^[a-z]/, letter => letter.toUpperCase());
  }

  private isVariableReassigned(lines: string[], declarationIndex: number): boolean {
    // Extract variable name from declaration
    const declarationLine = lines[declarationIndex];
    const match = declarationLine.match(/let\s+(\w+)/);
    if (!match) return false;
    
    const variableName = match[1];
    
    // Check subsequent lines for reassignment
    for (let i = declarationIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes(`${variableName} =`) || line.includes(`${variableName}+=`) || 
          line.includes(`${variableName}-=`) || line.includes(`${variableName}++`) || 
          line.includes(`${variableName}--`)) {
        return true;
      }
    }
    
    return false;
  }

  private getDefaultRules(): string[] {
    return [
      "consistent-naming",
      "remove-unused-imports", 
      "organize-imports",
      "format-code"
    ];
  }
}