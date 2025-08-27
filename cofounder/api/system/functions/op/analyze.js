import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { execFile } from 'child_process';
const readFileAsync = promisify(fs.readFile);
const readdirAsync = promisify(fs.readdir);
const statAsync = promisify(fs.stat);
const execFileAsync = promisify(execFile);

// Framework patterns for better detection
const FRAMEWORK_PATTERNS = {
    backend: {
        express: {
            files: ['app.js', 'server.js', 'index.js'],
            dependencies: ['express'],
            patterns: [
                /app\s*=\s*express\(\)/,
                /router\s*=\s*express\.Router\(\)/
            ]
        },
        fastify: {
            files: ['app.js', 'server.js', 'index.js'],
            dependencies: ['fastify'],
            patterns: [
                /fastify\(\{/,
                /fastify\.register\(/
            ]
        },
        nest: {
            files: ['main.ts', 'app.module.ts'],
            dependencies: ['@nestjs/core'],
            patterns: [
                /@Module\(\{/,
                /@Controller\(\)/
            ]
        },
        django: {
            files: ['manage.py', 'wsgi.py'],
            dependencies: ['django'],
            patterns: [
                /from django/,
                /INSTALLED_APPS/
            ]
        },
        flask: {
            files: ['app.py', 'wsgi.py'],
            dependencies: ['flask'],
            patterns: [
                /from flask import/,
                /Flask\(__name__\)/
            ]
        }
    },
    frontend: {
        react: {
            files: ['App.jsx', 'App.tsx', 'index.jsx', 'index.tsx'],
            dependencies: ['react', 'react-dom'],
            patterns: [
                /import React/,
                /from ['"]react['"]/
            ]
        },
        vue: {
            files: ['App.vue', 'main.js', 'main.ts'],
            dependencies: ['vue'],
            patterns: [
                /<template>/,
                /createApp\(/
            ]
        },
        angular: {
            files: ['app.module.ts', 'main.ts'],
            dependencies: ['@angular/core'],
            patterns: [
                /@NgModule\(\{/,
                /platformBrowserDynamic/
            ]
        },
        svelte: {
            files: ['App.svelte', 'main.js'],
            dependencies: ['svelte'],
            patterns: [
                /<script>/,
                /new App\(\{/
            ]
        }
    },
    database: {
        mongoose: {
            files: ['models/*.js', 'models/*.ts'],
            dependencies: ['mongoose'],
            patterns: [
                /mongoose\.Schema\(/,
                /mongoose\.model\(/
            ]
        },
        sequelize: {
            files: ['models/*.js', 'models/*.ts'],
            dependencies: ['sequelize'],
            patterns: [
                /extends Model/,
                /sequelize\.define\(/
            ]
        },
        typeorm: {
            files: ['entities/*.ts', 'models/*.ts'],
            dependencies: ['typeorm'],
            patterns: [
                /@Entity\(\)/,
                /@Column\(\)/
            ]
        },
        prisma: {
            files: ['schema.prisma'],
            dependencies: ['@prisma/client'],
            patterns: [
                /model \w+ \{/,
                /provider = ".*"/
            ]
        }
    }
};

async function findFiles(dir, pattern) {
    const files = [];
    
    async function walk(currentPath) {
        const entries = await readdirAsync(currentPath);
        
        for (const entry of entries) {
            if (entry.startsWith('.')) continue;
            
            const fullPath = path.join(currentPath, entry);
            const stat = await statAsync(fullPath);
            
            if (stat.isDirectory()) {
                await walk(fullPath);
            } else if (pattern.test(entry)) {
                files.push(fullPath);
            }
        }
    }
    
    await walk(dir);
    return files;
}

async function findDatabaseSchemas(projectPath) {
    const schemas = {};
    const modelFiles = await findFiles(projectPath, /models?\.js$|schemas?\.js$/i);
    
    for (const file of modelFiles) {
        try {
            const content = await readFileAsync(file, 'utf8');
            // Basic model detection - can be improved
            const modelMatches = content.matchAll(/class\s+(\w+)\s+extends\s+Model\s*{([^}]*)}/g);
            
            for (const match of modelMatches) {
                const [_, className, fieldsStr] = match;
                const fields = [];
                
                // Extract fields from class body
                const fieldMatches = fieldsStr.matchAll(/(\w+)\s*:\s*(\{[^}]*\})/g);
                for (const [__, fieldName, fieldDef] of fieldMatches) {
                    fields.push({
                        name: fieldName,
                        definition: fieldDef.trim()
                    });
                }
                
                schemas[className] = {
                    fields,
                    file: path.relative(projectPath, file)
                };
            }
        } catch (err) {
            console.error(`Error processing ${file}:`, err);
        }
    }
    
    return schemas;
}

async function findApiEndpoints(projectPath) {
    const endpoints = {};
    const routeFiles = await findFiles(projectPath, /routes?\.js$|controllers?\.js$/i);
    
    for (const file of routeFiles) {
        try {
            const content = await readFileAsync(file, 'utf8');
            
            // Find Express.js route definitions
            const routeMatches = content.matchAll(/\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/g);
            
            for (const [_, method, route] of routeMatches) {
                endpoints[`${method.toUpperCase()} ${route}`] = {
                    file: path.relative(projectPath, file)
                };
            }
        } catch (err) {
            console.error(`Error processing ${file}:`, err);
        }
    }
    
    return endpoints;
}

async function findFrontendComponents(projectPath) {
    const components = {};
    const routes = [];
    
    // Find React components
    const componentFiles = await findFiles(projectPath, /\.(jsx|tsx)$/);
    
    for (const file of componentFiles) {
        try {
            const content = await readFileAsync(file, 'utf8');
            const fileName = path.basename(file);
            
            // Basic React component detection
            if (content.includes('React.') || content.includes('export default')) {
                components[fileName] = {
                    type: 'component',
                    file: path.relative(projectPath, file)
                };
                
                // Check if it's a route component
                if (content.includes('<Route') || content.includes('useRoutes')) {
                    routes.push(path.relative(projectPath, file));
                }
            }
        } catch (err) {
            console.error(`Error processing ${file}:`, err);
        }
    }
    
    return { components, routes };
}

async function findDependencies(projectPath) {
    const dependencies = {};
    
    // Check package.json
    try {
        const packageJsonPath = path.join(projectPath, 'package.json');
        const content = await readFileAsync(packageJsonPath, 'utf8');
        const pkg = JSON.parse(content);
        
        dependencies.npm = {
            dependencies: pkg.dependencies || {},
            devDependencies: pkg.devDependencies || {}
        };
    } catch (err) {
        console.error('Error reading package.json:', err);
    }
    
    return dependencies;
}

class ProjectAnalyzer {
    constructor(projectPath) {
        this.projectPath = projectPath;
        this.dbSchemas = {};
        this.apiSpecs = {};
        this.frontendComponents = {};
        this.dependencies = {};
        this.routes = [];
        this.frameworks = {
            backend: null,
            frontend: null,
            database: null
        };
        this.documentation = {};
        this.gitInfo = {};
        this.envVars = {};
        this.dependencyGraph = {};
    }

    async detectFrameworks() {
        for (const [type, frameworks] of Object.entries(FRAMEWORK_PATTERNS)) {
            for (const [framework, patterns] of Object.entries(frameworks)) {
                // Check for framework files
                const hasFiles = await Promise.all(
                    patterns.files.map(async (file) => {
                        try {
                            const matches = await findFiles(this.projectPath, new RegExp(file.replace('*', '.*')));
                            return matches.length > 0;
                        } catch (err) {
                            return false;
                        }
                    })
                );

                // Check dependencies
                const hasDeps = await this._checkDependencies(patterns.dependencies);

                // Check code patterns
                const hasPatterns = await Promise.all(
                    patterns.files.map(async (file) => {
                        try {
                            const matches = await findFiles(this.projectPath, new RegExp(file.replace('*', '.*')));
                            for (const match of matches) {
                                const content = await readFileAsync(match, 'utf8');
                                if (patterns.patterns.some(pattern => pattern.test(content))) {
                                    return true;
                                }
                            }
                            return false;
                        } catch (err) {
                            return false;
                        }
                    })
                );

                if (hasFiles.some(Boolean) && hasDeps && hasPatterns.some(Boolean)) {
                    this.frameworks[type] = framework;
                    break;
                }
            }
        }
    }

    async _checkDependencies(deps) {
        try {
            const packageJsonPath = path.join(this.projectPath, 'package.json');
            const requirementsPath = path.join(this.projectPath, 'requirements.txt');
            
            if (await this._fileExists(packageJsonPath)) {
                const pkg = JSON.parse(await readFileAsync(packageJsonPath, 'utf8'));
                const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
                return deps.every(dep => allDeps[dep]);
            }
            
            if (await this._fileExists(requirementsPath)) {
                const reqs = (await readFileAsync(requirementsPath, 'utf8')).split('\n');
                return deps.every(dep => reqs.some(req => req.startsWith(dep)));
            }
            
            return false;
        } catch (err) {
            return false;
        }
    }

    async _fileExists(filePath) {
        try {
            await statAsync(filePath);
            return true;
        } catch (err) {
            return false;
        }
    }

    async extractDocumentation() {
        const docFiles = await findFiles(this.projectPath, /\.(md|rst|txt)$/i);
        
        for (const file of docFiles) {
            try {
                const content = await readFileAsync(file, 'utf8');
                const relativePath = path.relative(this.projectPath, file);
                this.documentation[relativePath] = content;
            } catch (err) {
                console.error(`Error reading documentation file ${file}:`, err);
            }
        }
    }

    async analyzeGitRepository() {
        try {
            const gitPath = path.join(this.projectPath, '.git');
            if (!await this._fileExists(gitPath)) {
                return;
            }

            // Get commit history
            const { stdout: logOutput } = await execFileAsync('git', [
                '--git-dir', gitPath,
                'log',
                '--pretty=format:%H|%an|%ae|%at|%s'
            ]);

            const commits = logOutput.split('\n').map(line => {
                const [hash, author, email, timestamp, message] = line.split('|');
                return { hash, author, email, timestamp: parseInt(timestamp), message };
            });

            // Get branches
            const { stdout: branchOutput } = await execFileAsync('git', [
                '--git-dir', gitPath,
                'branch',
                '-a'
            ]);

            const branches = branchOutput.split('\n')
                .map(b => b.trim())
                .filter(Boolean);

            this.gitInfo = {
                commits,
                branches,
                remotes: branches.filter(b => b.startsWith('remotes/')),
                mainBranch: branches.find(b => b.includes('main') || b.includes('master'))
            };
        } catch (err) {
            console.error('Error analyzing git repository:', err);
        }
    }

    async analyzeEnvironmentVariables() {
        const envFiles = [
            '.env',
            '.env.example',
            '.env.sample',
            '.env.template',
            '.env.development',
            '.env.production'
        ];

        for (const file of envFiles) {
            const envPath = path.join(this.projectPath, file);
            try {
                if (await this._fileExists(envPath)) {
                    const content = await readFileAsync(envPath, 'utf8');
                    const vars = {};
                    
                    content.split('\n').forEach(line => {
                        line = line.trim();
                        if (line && !line.startsWith('#')) {
                            const [key, ...valueParts] = line.split('=');
                            const value = valueParts.join('=');
                            if (key) {
                                vars[key.trim()] = value ? value.trim() : '';
                            }
                        }
                    });

                    this.envVars[file] = vars;
                }
            } catch (err) {
                console.error(`Error reading env file ${file}:`, err);
            }
        }
    }

    async buildDependencyGraph() {
        const graph = {
            nodes: [],
            edges: []
        };

        // Add framework nodes
        for (const [type, framework] of Object.entries(this.frameworks)) {
            if (framework) {
                graph.nodes.push({
                    id: `framework_${type}`,
                    label: framework,
                    type: 'framework'
                });
            }
        }

        // Add database nodes
        Object.keys(this.dbSchemas).forEach(schema => {
            graph.nodes.push({
                id: `schema_${schema}`,
                label: schema,
                type: 'database'
            });
        });

        // Add API nodes
        Object.keys(this.apiSpecs).forEach(endpoint => {
            graph.nodes.push({
                id: `api_${endpoint}`,
                label: endpoint,
                type: 'api'
            });
        });

        // Add frontend component nodes
        Object.keys(this.frontendComponents).forEach(component => {
            graph.nodes.push({
                id: `component_${component}`,
                label: component,
                type: 'frontend'
            });
        });

        // Add edges based on imports and dependencies
        const files = await findFiles(this.projectPath, /\.(js|jsx|ts|tsx)$/);
        
        for (const file of files) {
            try {
                const content = await readFileAsync(file, 'utf8');
                const imports = content.match(/import .* from ['"]([^'"]+)['"]/g) || [];
                
                imports.forEach(imp => {
                    const match = imp.match(/from ['"]([^'"]+)['"]/);
                    if (match) {
                        const [_, importPath] = match;
                        graph.edges.push({
                            source: path.basename(file),
                            target: importPath,
                            type: 'import'
                        });
                    }
                });
            } catch (err) {
                console.error(`Error analyzing dependencies in ${file}:`, err);
            }
        }

        this.dependencyGraph = graph;
    }

    async analyze() {
        // Run all analysis steps
        await this.detectFrameworks();
        this.dbSchemas = await findDatabaseSchemas(this.projectPath);
        this.apiSpecs = await findApiEndpoints(this.projectPath);
        const { components, routes } = await findFrontendComponents(this.projectPath);
        this.frontendComponents = components;
        this.routes = routes;
        this.dependencies = await findDependencies(this.projectPath);
        await this.extractDocumentation();
        await this.analyzeGitRepository();
        await this.analyzeEnvironmentVariables();
        await this.buildDependencyGraph();

        // Generate blueprint in Cofounder's format
        const blueprint = {
            // PM Documents
            'pm.details': {
                type: 'yaml',
                content: {
                    project_path: this.projectPath,
                    analyzed_at: new Date().toISOString(),
                    type: 'auto-generated from existing project',
                    frameworks: this.frameworks
                }
            },
            
            // Database
            'db.schemas': {
                type: 'yaml',
                content: this.dbSchemas
            },
            
            // Backend
            'backend.specifications.openapi': {
                type: 'complex',
                content: {
                    openapi: '3.0.0',
                    info: {
                        title: path.basename(this.projectPath) + ' API',
                        version: '1.0.0'
                    },
                    paths: Object.entries(this.apiSpecs).reduce((acc, [endpoint, spec]) => {
                        const [method, route] = endpoint.split(' ');
                        acc[route] = {
                            [method.toLowerCase()]: {
                                summary: `Endpoint from ${spec.file}`,
                                responses: {
                                    '200': {
                                        description: 'Successful response'
                                    }
                                }
                            }
                        };
                        return acc;
                    }, {})
                }
            },
            
            // Frontend
            'uxsitemap.structure': {
                type: 'yaml',
                content: {
                    routes: this.routes,
                    components: this.frontendComponents
                }
            },
            
            // Settings
            'settings.config.package': {
                type: 'yaml',
                content: {
                    ...this.dependencies,
                    environment: this.envVars
                }
            },

            // Documentation
            'pm.documentation': {
                type: 'yaml',
                content: this.documentation
            },

            // Git Info
            'settings.version_control': {
                type: 'yaml',
                content: this.gitInfo
            },

            // Dependency Graph
            'settings.architecture': {
                type: 'yaml',
                content: this.dependencyGraph
            }
        };
        
        return blueprint;
    }
}

async function analyzeProject(projectPath) {
    const analyzer = new ProjectAnalyzer(projectPath);
    return await analyzer.analyze();
}

export {
    analyzeProject
};