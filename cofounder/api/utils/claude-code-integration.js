import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Claude Code Integration Service
 * Provides a bridge between Cofounder and local Claude Code CLI
 * Enhanced to handle all system functions that require LLM operations
 */
export class ClaudeCodeIntegration {
    constructor(config = {}) {
        this.config = {
            claudeCommand: config.claudeCommand || 'claude',
            timeout: config.timeout || 300000, // 5 minutes default
            ...config
        };
        this.initialized = false;
    }

    /**
     * Initialize and check if Claude CLI is available and authenticated
     */
    async initialize() {
        try {
            // Check if Claude CLI is available
            const isAvailable = await this.checkClaudeAvailability();
            if (!isAvailable) {
                throw new Error('Claude CLI is not available or not in PATH');
            }

            // Test authentication
            const isAuthenticated = await this.checkAuthentication();
            if (!isAuthenticated) {
                throw new Error('Claude CLI is not authenticated');
            }

            this.initialized = true;
            console.log('[ClaudeCodeIntegration] Successfully initialized');
            return true;
        } catch (error) {
            console.error('[ClaudeCodeIntegration] Initialization failed:', error.message);
            throw error;
        }
    }

    /**
     * Check if Claude CLI is available
     */
    async checkClaudeAvailability() {
        return new Promise((resolve) => {
            // Try different methods to check for Claude CLI availability
            const checkMethods = [
                () => spawn('which', ['claude']),
                () => spawn('where', ['claude']), // Windows
                () => spawn('command', ['-v', 'claude']), // Alternative Unix
            ];

            let methodIndex = 0;

            const tryNextMethod = () => {
                if (methodIndex >= checkMethods.length) {
                    resolve(false);
                    return;
                }

                try {
                    const process = checkMethods[methodIndex]();
                    
                    process.on('close', (code) => {
                        if (code === 0) {
                            resolve(true);
                        } else {
                            methodIndex++;
                            tryNextMethod();
                        }
                    });

                    process.on('error', () => {
                        methodIndex++;
                        tryNextMethod();
                    });
                } catch (error) {
                    methodIndex++;
                    tryNextMethod();
                }
            };

            tryNextMethod();
        });
    }

    /**
     * Check if Claude CLI is authenticated
     */
    async checkAuthentication() {
        try {
            // First check if Claude CLI responds to basic commands (faster test)
            const configResult = await new Promise((resolve) => {
                const configProcess = spawn(this.config.claudeCommand, ['config', 'list'], {
                    stdio: ['pipe', 'pipe', 'pipe'],
                    timeout: 3000
                });
                
                let stdout = '';
                let stderr = '';
                
                configProcess.stdout.on('data', (data) => stdout += data.toString());
                configProcess.stderr.on('data', (data) => stderr += data.toString());
                
                const timeout = setTimeout(() => {
                    configProcess.kill('SIGTERM');
                    resolve({ success: false, error: 'Config command timeout' });
                }, 3000);
                
                configProcess.on('close', (code) => {
                    clearTimeout(timeout);
                    resolve({ 
                        success: code === 0, 
                        stdout, 
                        stderr, 
                        code 
                    });
                });
                
                configProcess.on('error', (error) => {
                    clearTimeout(timeout);
                    resolve({ success: false, error: error.message });
                });
            });
            
            if (!configResult.success) {
                console.log('[ClaudeCodeIntegration] Config command failed:', configResult.error);
                return false;
            }
            
            console.log('[ClaudeCodeIntegration] Claude CLI config accessible');
            
            // Now try a quick inference test with a very short timeout
            try {
                console.log('[ClaudeCodeIntegration] Running authentication test...');
                
                // Temporarily set initialized to true for auth test
                const wasInitialized = this.initialized;
                this.initialized = true;
                
                const response = await Promise.race([
                    this.executeCommand(['-p', '"just say hi"']),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Inference test timeout')), 600000)
                    )
                ]);
                
                // Restore original initialized state
                this.initialized = wasInitialized;
                
                console.log('[ClaudeCodeIntegration] Auth test response:', typeof response, response);
                
                // Check for successful response (exit code 0 AND valid content)
                if (response && typeof response === 'object' && response.exitCode === 0 && response.output && response.output.trim().length > 0) {
                    console.log('[ClaudeCodeIntegration] Authentication test successful');
                    return true;
                } else {
                    console.log('[ClaudeCodeIntegration] Authentication failed - exit code or invalid response');
                    return false;
                }
            } catch (error) {
                // Restore initialized state in case of error
                this.initialized = false;
                console.log('[ClaudeCodeIntegration] Quick inference test failed:', error.message);
                
                // If it's a timeout, it means Claude CLI is waiting for authentication
                if (error.message.includes('timeout')) {
                    console.log('[ClaudeCodeIntegration] Claude CLI appears to need authentication setup');
                    return false;
                }
                
                // Check for specific authentication errors
                if (error.message.includes('not authenticated') || 
                    error.message.includes('authentication') ||
                    error.message.includes('login') ||
                    error.message.includes('token')) {
                    return false;
                }
                
                // For raw mode issues, Claude is available but has display problems
                if (error.message.includes('Raw mode is not supported')) {
                    console.log('[ClaudeCodeIntegration] Raw mode issue detected, CLI available but may have display issues');
                    return true;
                }
            }
            
            // If config works but inference doesn't, likely needs authentication
            console.log('[ClaudeCodeIntegration] Claude CLI available but may need authentication (run `claude setup-token`)');
            return false;
            
        } catch (error) {
            console.log('[ClaudeCodeIntegration] Authentication check failed:', error.message);
            return false;
        }
    }

    /**
     * Execute Claude CLI command
     */
    async executeCommand(args = [], options = {}) {
        if (!this.initialized) {
            throw new Error('Claude Code integration not initialized');
        }

        try {
            // Use execSync approach exactly like the working example
            const cp = await import('child_process');
            const execSync = cp.execSync;
            
            // Build command string exactly like working example
            const commandStr = `claude ${args.join(' ')}`;
            console.log('[ClaudeCodeIntegration] Executing:', commandStr);
            
            const stdout = execSync(commandStr, { encoding: "utf8" });
            
            return {
                output: stdout.trim(),
                stderr: '',
                exitCode: 0
            };
            
        } catch (error) {
            console.log('[ClaudeCodeIntegration] Command failed:', error.message);
            return {
                output: error.stdout ? error.stdout.toString().trim() : '',
                stderr: error.stderr ? error.stderr.toString().trim() : error.message,
                exitCode: error.status || 1
            };
        }
    }

    /**
     * Send a message to Claude Code and get response
     */
    async inference(options = {}) {
        const {
            messages,
            model,
            temperature,
            maxTokens,
            tools,
            systemPrompt,
            cwd,
            allowedTools
        } = options;

        // Build Claude CLI arguments (flags only, prompt will be handled separately)
        const args = ['--print']; // Use print mode for non-interactive response

        // Add system prompt if provided
        if (systemPrompt) {
            args.push('--append-system-prompt', systemPrompt);
        }

        // Add allowed tools if provided
        if (allowedTools && allowedTools.length > 0) {
            args.push('--allowed-tools', allowedTools.join(','));
        }

        // Set permission mode for tool usage
        if (tools && tools.length > 0) {
            args.push('--permission-mode', 'acceptEdits');
        }

        // Add model if specified
        if (model) {
            args.push('--model', model);
        }

        // Extract the prompt
        let prompt = '';
        if (messages && messages.length > 0) {
            // Get the last user message
            const userMessage = messages[messages.length - 1];
            if (userMessage && userMessage.content) {
                if (typeof userMessage.content === 'string') {
                    prompt = userMessage.content;
                } else if (Array.isArray(userMessage.content)) {
                    // Handle multimodal content
                    prompt = userMessage.content
                        .filter(item => item.type === 'text')
                        .map(item => item.text)
                        .join('\n');
                }
            }
        } else if (options.prompt) {
            prompt = options.prompt;
        }

        // Add prompt as the last argument (this will be handled specially by executeCommand)
        if (prompt) {
            args.push(prompt);
        }

        try {
            const response = await this.executeCommand(args, { cwd });
            
            return {
                content: [{
                    type: 'text',
                    text: response.trim()
                }],
                role: 'assistant',
                model: model || 'claude-via-cli',
                usage: {
                    input_tokens: 0, // Claude CLI doesn't provide token counts
                    output_tokens: 0
                }
            };
        } catch (error) {
            throw new Error(`Claude Code inference failed: ${error.message}`);
        }
    }

    /**
     * Get Claude Code project information
     */
    async getProjectInfo(projectPath) {
        try {
            // Check if this is a Claude Code project
            const claudeDir = path.join(projectPath, '.claude');
            try {
                await fs.access(claudeDir);
                return {
                    isClaudeProject: true,
                    claudeDir: claudeDir,
                    projectPath: projectPath
                };
            } catch {
                return {
                    isClaudeProject: false,
                    projectPath: projectPath
                };
            }
        } catch (error) {
            throw new Error(`Failed to get project info: ${error.message}`);
        }
    }

    /**
     * Execute Claude Code command with streaming support
     */
    async executeWithStream(args = [], options = {}, onData) {
        if (!this.initialized) {
            throw new Error('Claude Code integration not initialized');
        }

        return new Promise((resolve, reject) => {
            const claudeProcess = spawn(this.config.claudeCommand, args, {
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: options.cwd || process.cwd(),
                env: { ...process.env, ...options.env }
            });

            let stdout = '';
            let stderr = '';

            claudeProcess.stdout.on('data', (data) => {
                const chunk = data.toString();
                stdout += chunk;
                if (onData) {
                    onData(chunk);
                }
            });

            claudeProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            const timeout = setTimeout(() => {
                claudeProcess.kill('SIGTERM');
                reject(new Error(`Command timed out after ${this.config.timeout}ms`));
            }, this.config.timeout);

            claudeProcess.on('close', (code) => {
                clearTimeout(timeout);
                
                if (code === 0) {
                    resolve(stdout);
                } else {
                    reject(new Error(`Claude CLI exited with code ${code}: ${stderr}`));
                }
            });

            claudeProcess.on('error', (error) => {
                clearTimeout(timeout);
                reject(new Error(`Failed to spawn Claude CLI: ${error.message}`));
            });

            if (options.input) {
                claudeProcess.stdin.write(options.input);
                claudeProcess.stdin.end();
            }
        });
    }

    /**
     * Get status information about Claude Code integration
     */
    getInfo() {
        return {
            type: 'ClaudeCodeIntegration',
            initialized: this.initialized,
            claudeCommand: this.config.claudeCommand,
            config: {
                timeout: this.config.timeout
            }
        };
    }

    /**
     * Execute system function through Claude Code bridge
     * This replaces direct API token usage for all LLM operations
     */
    async executeSystemFunction(params) {
        const { 
            functionType,    // e.g., 'PM:FRD::ANALYSIS'
            template,        // The specific template for this function
            context,         // Project context data  
            data,           // Input data for the function
            options = {}     // Additional options like model, temperature, etc.
        } = params;

        if (!this.initialized) {
            throw new Error('Claude Code integration not initialized');
        }

        try {
            // Format the prompt based on function type
            const prompt = this.formatSystemFunctionPrompt(functionType, template, context, data);
            
            // Execute via Claude Code
            const response = await this.executeCommand({
                args: ['--dangerously-skip-permissions', prompt],
                ...options
            });

            // Post-process response based on function type
            return this.processSystemFunctionResponse(functionType, response);
        } catch (error) {
            console.error(`[ClaudeCodeIntegration] System function ${functionType} failed:`, error);
            throw error;
        }
    }

    /**
     * Format prompt for system functions
     */
    formatSystemFunctionPrompt(functionType, template, context, data) {
        const basePrompt = `You are executing the Cofounder system function: ${functionType}

Context:
${JSON.stringify(context, null, 2)}

Input Data:
${JSON.stringify(data, null, 2)}

Template/Instructions:
${template}

Please generate the appropriate output for this system function following the template exactly.`;

        // Function-specific prompt enhancements
        switch (functionType.split('::')[0]) {
            case 'PM:PRD':
            case 'PM:FRD':
            case 'PM:DRD':
            case 'PM:BRD':
            case 'PM:UXSMD':
            case 'PM:UXDMD':
                return basePrompt + `\n\nOutput should be a well-structured document in markdown format.`;
                
            case 'BACKEND:OPENAPI':
            case 'BACKEND:ASYNCAPI':
                return basePrompt + `\n\nOutput should be valid OpenAPI/AsyncAPI specification in JSON format.`;
                
            case 'BACKEND:SERVER':
            case 'WEBAPP:STORE':
            case 'WEBAPP:ROOT':
            case 'WEBAPP:VIEW':
                return basePrompt + `\n\nOutput should be clean, production-ready code with proper imports and exports.`;
                
            case 'DB:SCHEMAS':
            case 'DB:POSTGRES':
                return basePrompt + `\n\nOutput should be valid SQL schema definitions.`;
                
            case 'UX:SITEMAP':
            case 'UX:DATAMAP':
                return basePrompt + `\n\nOutput should be structured JSON representing the site/data architecture.`;
                
            case 'SWARM:REVIEW':
            case 'SWARM:AUGMENT':
            case 'SWARM:FIX':
                return basePrompt + `\n\nOutput should include detailed analysis and code improvements.`;
                
            default:
                return basePrompt;
        }
    }

    /**
     * Process response from system functions
     */
    processSystemFunctionResponse(functionType, response) {
        try {
            // Clean up response - remove any Claude Code metadata
            let cleanResponse = response.trim();
            
            // Remove common Claude Code response artifacts
            if (cleanResponse.includes('```')) {
                // Extract code blocks if present
                const codeBlockRegex = /```(?:\w+)?\n([\s\S]*?)```/g;
                const matches = [...cleanResponse.matchAll(codeBlockRegex)];
                if (matches.length > 0) {
                    cleanResponse = matches.map(match => match[1]).join('\n\n');
                }
            }

            // Function-specific response processing
            const category = functionType.split('::')[0];
            
            switch (category) {
                case 'BACKEND:OPENAPI':
                case 'BACKEND:ASYNCAPI':
                case 'UX:SITEMAP':
                case 'UX:DATAMAP':
                    // Try to parse as JSON
                    try {
                        return JSON.parse(cleanResponse);
                    } catch {
                        // If not valid JSON, return as-is
                        return cleanResponse;
                    }
                    
                case 'DB:SCHEMAS':
                case 'DB:POSTGRES':
                    // Return SQL as-is
                    return cleanResponse;
                    
                default:
                    // Return processed text
                    return cleanResponse;
            }
        } catch (error) {
            console.error(`[ClaudeCodeIntegration] Response processing failed for ${functionType}:`, error);
            return response; // Return original response as fallback
        }
    }

    /**
     * Get function-specific configuration
     */
    getFunctionConfig(functionType) {
        const configs = {
            // Product Management functions
            'PM:PRD::ANALYSIS': {
                model: 'claude-3',
                temperature: 0.7,
                maxTokens: 4000
            },
            'PM:FRD::ANALYSIS': {
                model: 'claude-3',
                temperature: 0.5,
                maxTokens: 4000
            },
            'PM:DRD::ANALYSIS': {
                model: 'claude-3',
                temperature: 0.3,
                maxTokens: 3000
            },
            'PM:BRD::ANALYSIS': {
                model: 'claude-3',
                temperature: 0.6,
                maxTokens: 3000
            },
            'PM:UXSMD::ANALYSIS': {
                model: 'claude-3',
                temperature: 0.8,
                maxTokens: 4000
            },
            'PM:UXDMD::ANALYSIS': {
                model: 'claude-3',
                temperature: 0.8,
                maxTokens: 4000
            },
            
            // Backend functions
            'BACKEND:OPENAPI::DEFINE': {
                model: 'claude-3',
                temperature: 0.2,
                maxTokens: 3000
            },
            'BACKEND:ASYNCAPI::DEFINE': {
                model: 'claude-3',
                temperature: 0.2,
                maxTokens: 3000
            },
            'BACKEND:SERVER::GENERATE': {
                model: 'claude-3',
                temperature: 0.3,
                maxTokens: 6000
            },
            
            // Frontend functions
            'WEBAPP:STORE::GENERATE': {
                model: 'claude-3',
                temperature: 0.3,
                maxTokens: 4000
            },
            'WEBAPP:ROOT::GENERATE': {
                model: 'claude-3',
                temperature: 0.4,
                maxTokens: 4000
            },
            'WEBAPP:VIEW::GENERATE:MULTI': {
                model: 'claude-3',
                temperature: 0.4,
                maxTokens: 8000
            },
            
            // Database functions
            'DB:SCHEMAS::GENERATE': {
                model: 'claude-3',
                temperature: 0.2,
                maxTokens: 2000
            },
            'DB:POSTGRES::GENERATE': {
                model: 'claude-3',
                temperature: 0.2,
                maxTokens: 3000
            },
            
            // UX functions
            'UX:SITEMAP::STRUCTURE': {
                model: 'claude-3',
                temperature: 0.5,
                maxTokens: 2000
            },
            'UX:DATAMAP::STRUCTURE': {
                model: 'claude-3',
                temperature: 0.4,
                maxTokens: 2000
            },
            'UX:DATAMAP::VIEWS': {
                model: 'claude-3',
                temperature: 0.4,
                maxTokens: 3000
            },
            
            // Quality assurance functions
            'SWARM:REVIEW': {
                model: 'claude-3',
                temperature: 0.3,
                maxTokens: 4000
            },
            'SWARM:AUGMENT': {
                model: 'claude-3',
                temperature: 0.6,
                maxTokens: 4000
            },
            'SWARM:FIX': {
                model: 'claude-3',
                temperature: 0.4,
                maxTokens: 4000
            }
        };

        return configs[functionType] || {
            model: 'claude-3',
            temperature: 0.5,
            maxTokens: 4000
        };
    }

    /**
     * Check if integration is valid and working
     */
    async isValid() {
        if (!this.initialized) {
            return false;
        }

        try {
            await this.checkAuthentication();
            return true;
        } catch {
            return false;
        }
    }
}

export default ClaudeCodeIntegration;