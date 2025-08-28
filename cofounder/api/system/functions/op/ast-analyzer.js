import fs from 'fs';
import path from 'path';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import { promisify } from 'util';

const readFileAsync = promisify(fs.readFile);
const statAsync = promisify(fs.stat);
const readdirAsync = promisify(fs.readdir);

class ASTAnalyzer {
    constructor(projectPath) {
        this.projectPath = projectPath;
        this.fileNodes = new Map();
        this.connections = new Map();
        this.hierarchy = new Map();
        this.importGraph = new Map();
        this.exportGraph = new Map();
    }

    async analyzeFile(filePath) {
        try {
            const content = await readFileAsync(filePath, 'utf8');
            const relativePath = path.relative(this.projectPath, filePath);
            const ext = path.extname(filePath);
            
            // Skip non-JS/TS files
            if (!['.js', '.jsx', '.ts', '.tsx', '.mjs'].includes(ext)) {
                return null;
            }

            // Parse with Babel
            const ast = parse(content, {
                sourceType: 'unambiguous',
                plugins: [
                    'jsx',
                    'typescript',
                    'decorators-legacy',
                    'classProperties',
                    'dynamicImport',
                    'exportDefaultFrom',
                    'exportNamespaceFrom',
                    'asyncGenerators',
                    'functionBind',
                    'functionSent',
                    'objectRestSpread',
                    'optionalCatchBinding',
                    'optionalChaining',
                    'nullishCoalescingOperator'
                ],
                errorRecovery: true
            });

            const node = {
                path: relativePath,
                absolutePath: filePath,
                type: this.getFileType(filePath),
                depth: this.calculateDepth(relativePath),
                imports: [],
                exports: [],
                functions: [],
                classes: [],
                variables: [],
                connections: new Set()
            };

            // Traverse AST to extract information
            traverse.default(ast, {
                // Handle imports
                ImportDeclaration: (path) => {
                    const source = path.node.source.value;
                    const specifiers = path.node.specifiers.map(spec => {
                        if (spec.type === 'ImportDefaultSpecifier') {
                            return { name: spec.local.name, type: 'default' };
                        } else if (spec.type === 'ImportNamespaceSpecifier') {
                            return { name: spec.local.name, type: 'namespace' };
                        } else {
                            return { 
                                name: spec.imported.name, 
                                local: spec.local.name,
                                type: 'named' 
                            };
                        }
                    });
                    node.imports.push({ source, specifiers });
                },

                // Handle dynamic imports
                CallExpression: (path) => {
                    if (path.node.callee.type === 'Import') {
                        const arg = path.node.arguments[0];
                        if (arg && arg.type === 'StringLiteral') {
                            node.imports.push({ 
                                source: arg.value, 
                                specifiers: [],
                                dynamic: true 
                            });
                        }
                    }
                },

                // Handle exports
                ExportNamedDeclaration: (path) => {
                    if (path.node.declaration) {
                        // export const/let/function/class
                        if (path.node.declaration.type === 'VariableDeclaration') {
                            path.node.declaration.declarations.forEach(decl => {
                                if (decl.id.type === 'Identifier') {
                                    node.exports.push({ 
                                        name: decl.id.name, 
                                        type: 'named' 
                                    });
                                }
                            });
                        } else if (path.node.declaration.id) {
                            node.exports.push({ 
                                name: path.node.declaration.id.name, 
                                type: 'named' 
                            });
                        }
                    }
                    // export { ... }
                    if (path.node.specifiers) {
                        path.node.specifiers.forEach(spec => {
                            node.exports.push({ 
                                name: spec.exported.name, 
                                type: 'named' 
                            });
                        });
                    }
                },

                ExportDefaultDeclaration: (path) => {
                    node.exports.push({ 
                        name: 'default', 
                        type: 'default' 
                    });
                },

                // Handle function declarations
                FunctionDeclaration: (path) => {
                    if (path.node.id) {
                        node.functions.push({
                            name: path.node.id.name,
                            async: path.node.async,
                            generator: path.node.generator,
                            params: path.node.params.length
                        });
                    }
                },

                // Handle class declarations
                ClassDeclaration: (path) => {
                    if (path.node.id) {
                        const methods = [];
                        path.node.body.body.forEach(member => {
                            if (member.type === 'ClassMethod') {
                                methods.push({
                                    name: member.key.name,
                                    kind: member.kind,
                                    static: member.static
                                });
                            }
                        });
                        node.classes.push({
                            name: path.node.id.name,
                            methods
                        });
                    }
                },

                // Handle variable declarations
                VariableDeclaration: (path) => {
                    path.node.declarations.forEach(decl => {
                        if (decl.id.type === 'Identifier') {
                            node.variables.push({
                                name: decl.id.name,
                                kind: path.node.kind // const, let, var
                            });
                        }
                    });
                }
            });

            this.fileNodes.set(relativePath, node);
            return node;
        } catch (error) {
            console.error(`Error analyzing ${filePath}:`, error.message);
            return null;
        }
    }

    getFileType(filePath) {
        const basename = path.basename(filePath);
        const dir = path.dirname(filePath);
        
        // High-level specs
        if (basename.includes('PRD') || basename.includes('FRD') || basename.includes('DRD')) {
            return 'spec';
        }
        if (basename === 'package.json' || basename === 'tsconfig.json') {
            return 'config';
        }
        
        // Main entry points
        if (basename === 'index.js' || basename === 'index.ts' || 
            basename === 'main.js' || basename === 'main.ts' ||
            basename === 'server.js' || basename === 'app.js' ||
            basename === 'App.tsx' || basename === 'App.jsx') {
            return 'entry';
        }
        
        // Components
        if (dir.includes('components') || dir.includes('views') || dir.includes('pages')) {
            return 'component';
        }
        
        // Services/utilities
        if (dir.includes('services') || dir.includes('utils') || dir.includes('helpers')) {
            return 'utility';
        }
        
        // Models
        if (dir.includes('models') || dir.includes('schemas')) {
            return 'model';
        }
        
        // Routes/controllers
        if (dir.includes('routes') || dir.includes('controllers')) {
            return 'route';
        }
        
        // Tests
        if (dir.includes('test') || dir.includes('spec') || 
            basename.includes('.test.') || basename.includes('.spec.')) {
            return 'test';
        }
        
        return 'module';
    }

    calculateDepth(relativePath) {
        const parts = relativePath.split(path.sep);
        const basename = path.basename(relativePath);
        const dir = path.dirname(relativePath);
        
        // Level 0: High-level specs and docs
        if (basename.includes('PRD') || basename.includes('FRD') || 
            basename.includes('DRD') || basename.includes('README')) {
            return 0;
        }
        
        // Level 1: Core files (main entry points)
        if (basename === 'server.js' || basename === 'index.js' || 
            basename === 'App.tsx' || basename === 'main.ts' ||
            basename === 'package.json') {
            return 1;
        }
        
        // Level 2: Feature modules
        if (dir.includes('components') || dir.includes('routes') || 
            dir.includes('models') || dir.includes('views')) {
            return 2;
        }
        
        // Level 3: Utilities and helpers
        if (dir.includes('utils') || dir.includes('helpers') || 
            dir.includes('services')) {
            return 3;
        }
        
        // Level 4+: Deep implementation (based on directory depth)
        return Math.min(4 + Math.floor(parts.length / 3), 10);
    }

    async buildConnectionGraph() {
        // Build import relationships
        for (const [filePath, node] of this.fileNodes) {
            const connections = new Set();
            
            for (const imp of node.imports) {
                const resolvedPath = this.resolveImportPath(filePath, imp.source);
                if (resolvedPath && this.fileNodes.has(resolvedPath)) {
                    connections.add(resolvedPath);
                    
                    // Add reverse connection (file that imports this one)
                    if (!this.importGraph.has(resolvedPath)) {
                        this.importGraph.set(resolvedPath, new Set());
                    }
                    this.importGraph.get(resolvedPath).add(filePath);
                }
            }
            
            this.connections.set(filePath, connections);
            node.connections = connections;
        }
    }

    resolveImportPath(fromFile, importPath) {
        // Skip external modules
        if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
            return null;
        }
        
        const dir = path.dirname(fromFile);
        let resolved = path.join(dir, importPath);
        
        // Remove leading slash if present
        if (resolved.startsWith('/')) {
            resolved = resolved.slice(1);
        }
        
        // Try different extensions
        const extensions = ['', '.js', '.jsx', '.ts', '.tsx', '/index.js', '/index.ts'];
        for (const ext of extensions) {
            const candidate = resolved + ext;
            if (this.fileNodes.has(candidate)) {
                return candidate;
            }
        }
        
        return null;
    }

    getImporters(filePath) {
        return Array.from(this.importGraph.get(filePath) || []);
    }

    async analyzeDirectory(dir, basePath = null) {
        if (!basePath) basePath = this.projectPath;
        
        const entries = await readdirAsync(dir);
        const promises = [];
        
        for (const entry of entries) {
            // Skip common directories to ignore
            if (['node_modules', '.git', 'dist', 'build', '.next', 'coverage'].includes(entry)) {
                continue;
            }
            
            const fullPath = path.join(dir, entry);
            const stat = await statAsync(fullPath);
            
            if (stat.isDirectory()) {
                promises.push(this.analyzeDirectory(fullPath, basePath));
            } else if (stat.isFile()) {
                const ext = path.extname(entry);
                if (['.js', '.jsx', '.ts', '.tsx', '.mjs'].includes(ext)) {
                    promises.push(this.analyzeFile(fullPath));
                }
            }
        }
        
        await Promise.all(promises);
    }

    async analyze() {
        console.log('Starting AST analysis of project...');
        
        // Analyze all JavaScript/TypeScript files
        await this.analyzeDirectory(this.projectPath);
        
        console.log(`Analyzed ${this.fileNodes.size} files`);
        
        // Build connection graph
        await this.buildConnectionGraph();
        
        // Generate analysis results
        const results = {
            fileCount: this.fileNodes.size,
            files: {},
            connections: {},
            hierarchy: {},
            statistics: {
                byType: {},
                byDepth: {},
                totalImports: 0,
                totalExports: 0,
                totalFunctions: 0,
                totalClasses: 0
            }
        };
        
        // Process each file node
        for (const [path, node] of this.fileNodes) {
            results.files[path] = {
                type: node.type,
                depth: node.depth,
                imports: node.imports.length,
                exports: node.exports.length,
                functions: node.functions.map(f => f.name),
                classes: node.classes.map(c => c.name),
                connections: Array.from(node.connections)
            };
            
            // Update statistics
            results.statistics.byType[node.type] = (results.statistics.byType[node.type] || 0) + 1;
            results.statistics.byDepth[node.depth] = (results.statistics.byDepth[node.depth] || 0) + 1;
            results.statistics.totalImports += node.imports.length;
            results.statistics.totalExports += node.exports.length;
            results.statistics.totalFunctions += node.functions.length;
            results.statistics.totalClasses += node.classes.length;
        }
        
        // Add connection information
        for (const [path, connections] of this.connections) {
            results.connections[path] = Array.from(connections);
        }
        
        return results;
    }

    // Get files at specific depth level
    getFilesAtDepth(maxDepth) {
        const files = [];
        for (const [path, node] of this.fileNodes) {
            if (node.depth <= maxDepth) {
                files.push({
                    path,
                    ...node
                });
            }
        }
        return files;
    }

    // Get related files for context highlighting
    getRelatedFiles(filePath, maxDepth = 2) {
        const related = new Set();
        const visited = new Set();
        
        this.findRelatedRecursive(filePath, related, visited, maxDepth);
        
        return Array.from(related);
    }

    findRelatedRecursive(filePath, related, visited, depth) {
        if (depth <= 0 || visited.has(filePath)) return;
        
        visited.add(filePath);
        const node = this.fileNodes.get(filePath);
        
        if (!node) return;
        
        // Add files this file imports
        for (const connection of node.connections) {
            related.add(connection);
            this.findRelatedRecursive(connection, related, visited, depth - 1);
        }
        
        // Add files that import this file
        const importers = this.getImporters(filePath);
        for (const importer of importers) {
            related.add(importer);
            this.findRelatedRecursive(importer, related, visited, depth - 1);
        }
    }
}

export { ASTAnalyzer };