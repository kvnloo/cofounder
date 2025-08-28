import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Claude Code Integration Service
 * Provides a bridge between Cofounder and local Claude Code CLI
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
                const response = await Promise.race([
                    this.executeCommand(['--print', 'hi'], {}),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Inference test timeout')), 5000)
                    )
                ]);
                
                if (response && response.trim().length > 0) {
                    console.log('[ClaudeCodeIntegration] Authentication test successful');
                    return true;
                }
            } catch (error) {
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

        return new Promise((resolve, reject) => {
            // Separate prompt from other arguments
            let prompt = null;
            const commandArgs = [];
            
            // Look for the prompt (first non-flag argument)
            let promptFound = false;
            for (let i = 0; i < args.length; i++) {
                const arg = args[i];
                if (!arg.startsWith('-') && !promptFound) {
                    prompt = arg;
                    promptFound = true;
                } else {
                    commandArgs.push(arg);
                }
            }

            // Add dangerously-skip-permissions if not already present
            if (!commandArgs.includes('--dangerously-skip-permissions') && 
                !commandArgs.includes('--permission-mode')) {
                commandArgs.push('--dangerously-skip-permissions');
            }

            // Create the spawn arguments
            const spawnArgs = [this.config.claudeCommand, ...commandArgs];
            
            console.log('[ClaudeCodeIntegration] Executing:', spawnArgs.join(' '));
            if (prompt) {
                console.log('[ClaudeCodeIntegration] With prompt:', prompt.substring(0, 100) + '...');
            }

            const claudeProcess = spawn(spawnArgs[0], spawnArgs.slice(1), {
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: options.cwd || process.cwd(),
                env: { ...process.env, ...options.env }
            });

            let stdout = '';
            let stderr = '';

            claudeProcess.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            claudeProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            // Set timeout
            const timeout = setTimeout(() => {
                claudeProcess.kill('SIGTERM');
                reject(new Error(`Command timed out after ${this.config.timeout}ms`));
            }, this.config.timeout);

            claudeProcess.on('close', (code) => {
                clearTimeout(timeout);
                
                console.log('[ClaudeCodeIntegration] Command finished with code:', code);
                console.log('[ClaudeCodeIntegration] Stdout length:', stdout.length);
                if (stderr) {
                    console.log('[ClaudeCodeIntegration] Stderr:', stderr.substring(0, 200));
                }
                
                // If we have stdout, consider it a success
                if (stdout.trim().length > 0) {
                    resolve(stdout);
                } else if (code === 0) {
                    resolve(stdout);
                } else {
                    // Check for specific error patterns
                    if (stderr.includes('Raw mode is not supported')) {
                        reject(new Error('Claude CLI has raw mode issues in this environment'));
                    } else if (stderr.includes('not authenticated') || stderr.includes('authentication')) {
                        reject(new Error('Claude CLI authentication failed - please run `claude setup-token`'));
                    } else {
                        reject(new Error(`Claude CLI exited with code ${code}: ${stderr}`));
                    }
                }
            });

            claudeProcess.on('error', (error) => {
                clearTimeout(timeout);
                reject(new Error(`Failed to spawn Claude CLI: ${error.message}`));
            });

            // Send prompt via stdin if provided
            if (prompt) {
                claudeProcess.stdin.write(prompt);
                claudeProcess.stdin.end();
            } else if (options.input) {
                claudeProcess.stdin.write(options.input);
                claudeProcess.stdin.end();
            } else {
                claudeProcess.stdin.end();
            }
        });
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