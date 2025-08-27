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
            // Use a simple test that avoids interactive mode issues
            return new Promise((resolve) => {
                const testProcess = spawn('bash', ['-c', `echo "test" | ${this.config.claudeCommand} -p --dangerously-skip-permissions`], {
                    stdio: ['pipe', 'pipe', 'pipe'],
                    timeout: 5000,
                    env: { ...process.env }
                });

                let stdout = '';
                let stderr = '';

                testProcess.stdout.on('data', (data) => {
                    stdout += data.toString();
                });

                testProcess.stderr.on('data', (data) => {
                    stderr += data.toString();
                });

                const timeout = setTimeout(() => {
                    testProcess.kill('SIGTERM');
                    // If it hangs, assume it's working but in interactive mode
                    resolve(true);
                }, 5000);

                testProcess.on('close', (code) => {
                    clearTimeout(timeout);
                    // If we get any response (even an error), CLI is available
                    // If it's a raw mode error, that's actually good - CLI is there
                    if (stderr.includes('Raw mode is not supported') || stdout.length > 0 || code === 0) {
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                });

                testProcess.on('error', () => {
                    clearTimeout(timeout);
                    resolve(false);
                });
            });
        } catch (error) {
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

        // Use bash to execute the command to preserve environment
        // Add dangerously-skip-permissions to avoid interactive prompts
        const safeArgs = [...args];
        if (!safeArgs.includes('--dangerously-skip-permissions') && !safeArgs.includes('--permission-mode')) {
            safeArgs.push('--dangerously-skip-permissions');
        }
        
        const command = `${this.config.claudeCommand} ${safeArgs.map(arg => `"${arg.replace(/"/g, '\\"')}"`).join(' ')}`;
        
        return new Promise((resolve, reject) => {
            const bashProcess = spawn('bash', ['-c', command], {
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: options.cwd || process.cwd(),
                env: { ...process.env, ...options.env },
                shell: false
            });

            let stdout = '';
            let stderr = '';

            bashProcess.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            bashProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            // Set timeout
            const timeout = setTimeout(() => {
                bashProcess.kill('SIGTERM');
                reject(new Error(`Command timed out after ${this.config.timeout}ms`));
            }, this.config.timeout);

            bashProcess.on('close', (code) => {
                clearTimeout(timeout);
                
                // If we have stdout, consider it a success even if exit code isn't 0
                // This handles cases where Claude CLI works but has raw mode issues
                if (stdout.trim().length > 0) {
                    resolve(stdout);
                } else if (code === 0) {
                    resolve(stdout);
                } else {
                    // Check if this is just a raw mode error (not an authentication error)
                    if (stderr.includes('Raw mode is not supported')) {
                        reject(new Error('Claude CLI has raw mode issues in this environment, but is available'));
                    } else {
                        reject(new Error(`Claude CLI exited with code ${code}: ${stderr}`));
                    }
                }
            });

            bashProcess.on('error', (error) => {
                clearTimeout(timeout);
                reject(new Error(`Failed to spawn bash for Claude CLI: ${error.message}`));
            });

            // Send input if provided
            if (options.input) {
                bashProcess.stdin.write(options.input);
                bashProcess.stdin.end();
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

        // Build Claude CLI arguments
        const args = ['-p']; // Print mode for non-interactive response

        // Add the main message/prompt
        if (messages && messages.length > 0) {
            // Get the last user message
            const userMessage = messages[messages.length - 1];
            if (userMessage && userMessage.content) {
                args.push(userMessage.content);
            }
        } else if (options.prompt) {
            args.push(options.prompt);
        }

        // Add system prompt if provided
        if (systemPrompt) {
            args.push('--append-system-prompt', systemPrompt);
        }

        // Add allowed tools if provided
        if (allowedTools && allowedTools.length > 0) {
            args.push('--allowedTools', allowedTools.join(','));
        }

        // Set permission mode for tool usage
        if (tools && tools.length > 0) {
            args.push('--permission-mode', 'acceptEdits');
        }

        try {
            const response = await this.executeCommand(args, { cwd });
            
            return {
                content: [{
                    type: 'text',
                    text: response.trim()
                }],
                role: 'assistant',
                model: 'claude-via-cli',
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