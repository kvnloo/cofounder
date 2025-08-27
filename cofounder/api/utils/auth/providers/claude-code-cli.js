import { ClaudeCodeIntegration } from '../../claude-code-integration.js';

/**
 * Claude Code CLI Provider
 * 
 * Uses local Claude Code CLI installation for authentication and inference
 * This leverages existing Claude Code authentication instead of requiring separate setup
 */
export class ClaudeCodeCliProvider {
    constructor(config = {}) {
        this.config = config;
        this.integration = new ClaudeCodeIntegration(config);
        this.initialized = false;
        this.lastError = null;
    }

    async initialize() {
        try {
            await this.integration.initialize();
            this.initialized = true;
            this.lastError = null;
            
            console.log('[ClaudeCodeCliProvider] Initialized successfully');
        } catch (error) {
            this.initialized = false;
            this.lastError = {
                message: error.message,
                context: 'initialization',
                timestamp: Date.now()
            };
            
            console.error('[ClaudeCodeCliProvider] Initialization failed:', error.message);
            throw error;
        }
    }

    async authenticate() {
        // Authentication is handled by Claude CLI itself
        // We just need to verify it's working
        try {
            const isValid = await this.integration.checkAuthentication();
            if (!isValid) {
                throw new Error('Claude CLI authentication check failed');
            }
            
            this.lastError = null;
            return true;
        } catch (error) {
            this.lastError = {
                message: error.message,
                context: 'authentication',
                timestamp: Date.now()
            };
            throw error;
        }
    }

    async isValid() {
        if (!this.initialized) {
            return false;
        }

        try {
            return await this.integration.isValid();
        } catch {
            return false;
        }
    }

    async inference(options) {
        try {
            if (!this.initialized) {
                throw new Error('Claude Code CLI provider not initialized');
            }

            // Transform the options to match Claude CLI expectations
            const claudeOptions = {
                ...options,
                // Map common parameters
                prompt: options.messages ? this._extractPrompt(options.messages) : options.prompt,
                systemPrompt: options.systemPrompt || options.system,
                cwd: options.cwd || process.cwd(),
                allowedTools: options.allowedTools || ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep']
            };

            const response = await this.integration.inference(claudeOptions);
            
            // Transform response to match expected format
            return {
                content: response.content,
                role: 'assistant',
                model: response.model || 'claude-via-cli',
                usage: response.usage || { input_tokens: 0, output_tokens: 0 },
                provider: 'claude-code-cli'
            };
        } catch (error) {
            this.lastError = {
                message: error.message,
                context: 'inference',
                timestamp: Date.now()
            };
            throw error;
        }
    }

    async vectorize(options) {
        // Claude CLI doesn't have built-in vectorization
        // We could potentially implement this by asking Claude to generate embeddings
        throw new Error('Vectorization not supported by Claude Code CLI provider');
    }

    async transcribe(options) {
        // Claude CLI doesn't have built-in transcription
        throw new Error('Transcription not supported by Claude Code CLI provider');
    }

    /**
     * Extract prompt from messages array
     */
    _extractPrompt(messages) {
        if (!messages || !Array.isArray(messages)) {
            return '';
        }

        // Find the last user message
        for (let i = messages.length - 1; i >= 0; i--) {
            const message = messages[i];
            if (message.role === 'user' && message.content) {
                if (typeof message.content === 'string') {
                    return message.content;
                } else if (Array.isArray(message.content)) {
                    // Handle content array (multimodal)
                    return message.content
                        .filter(item => item.type === 'text')
                        .map(item => item.text)
                        .join('\n');
                }
            }
        }

        return '';
    }

    /**
     * Execute Claude Code with streaming support
     */
    async inferenceWithStream(options, onData) {
        try {
            if (!this.initialized) {
                throw new Error('Claude Code CLI provider not initialized');
            }

            const args = ['-p']; // Print mode
            
            const prompt = options.messages ? this._extractPrompt(options.messages) : options.prompt;
            if (prompt) {
                args.push(prompt);
            }

            if (options.systemPrompt) {
                args.push('--append-system-prompt', options.systemPrompt);
            }

            if (options.allowedTools && options.allowedTools.length > 0) {
                args.push('--allowedTools', options.allowedTools.join(','));
            }

            const response = await this.integration.executeWithStream(args, {
                cwd: options.cwd || process.cwd()
            }, onData);

            return {
                content: [{
                    type: 'text',
                    text: response.trim()
                }],
                role: 'assistant',
                model: 'claude-via-cli',
                provider: 'claude-code-cli'
            };
        } catch (error) {
            this.lastError = {
                message: error.message,
                context: 'streaming_inference',
                timestamp: Date.now()
            };
            throw error;
        }
    }

    getInfo() {
        return {
            type: 'claude-code-cli',
            initialized: this.initialized,
            lastError: this.lastError,
            config: {
                claudeCommand: this.integration.config.claudeCommand,
                timeout: this.integration.config.timeout
            }
        };
    }

    /**
     * Get project information if this is a Claude Code project
     */
    async getProjectInfo(projectPath) {
        return await this.integration.getProjectInfo(projectPath);
    }
}

export default ClaudeCodeCliProvider;