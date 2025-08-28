import { ApiKeyProvider } from './providers/api-key.js';
import { ClaudeSessionProvider } from './providers/claude-session.js';
import { ClaudeCodeCliProvider } from './providers/claude-code-cli.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Authentication Manager
 * 
 * Manages authentication providers and provides a unified interface
 * for LLM operations across different authentication methods
 */
export class AuthManager {
	constructor(config = {}) {
		this.config = config;
		this.providers = new Map();
		this.activeProvider = null;
		this.preferredProviderType = config.preferredProvider || process.env.AUTH_PROVIDER || 'api-key';
		this.fallbackEnabled = config.fallbackEnabled !== false;
		this.initialized = false;
	}

	async initialize() {
		if (this.initialized) {
			return;
		}

		try {
			await this._initializeProviders();
			await this._selectActiveProvider();
			this.initialized = true;
			
			console.log(`[AuthManager] Initialized with provider: ${this.activeProvider?.constructor.name}`);
		} catch (error) {
			console.error('[AuthManager] Initialization failed:', error);
			throw error;
		}
	}

	async _initializeProviders() {
		// Initialize Claude Code CLI Provider first (preferred if available)
		try {
			const claudeCodeCliProvider = new ClaudeCodeCliProvider({
				timeout: 300000, // 5 minutes
			});
			await claudeCodeCliProvider.initialize();
			this.providers.set('claude-code-cli', claudeCodeCliProvider);
			console.log('[AuthManager] Claude Code CLI provider initialized successfully');
		} catch (error) {
			console.warn('[AuthManager] Claude Code CLI provider initialization failed:', error.message);
		}

		// Initialize API Key Provider
		try {
			const apiKeyProvider = new ApiKeyProvider({
				openaiApiKey: process.env.OPENAI_API_KEY,
				anthropicApiKey: process.env.ANTHROPIC_API_KEY,
			});
			await apiKeyProvider.initialize();
			this.providers.set('api-key', apiKeyProvider);
		} catch (error) {
			console.warn('[AuthManager] API Key provider initialization failed:', error.message);
		}

		// Initialize Claude Session Provider
		try {
			const claudeSessionProvider = new ClaudeSessionProvider({
				claudeCodePort: process.env.CLAUDE_CODE_PORT || 3000,
				sessionPath: process.env.CLAUDE_CODE_SESSION_PATH,
			});
			await claudeSessionProvider.initialize();
			this.providers.set('claude-session', claudeSessionProvider);
		} catch (error) {
			console.warn('[AuthManager] Claude Session provider initialization failed:', error.message);
		}

		if (this.providers.size === 0) {
			throw new Error('No authentication providers could be initialized');
		}
	}

	async _selectActiveProvider() {
		// Check if we're running inside Claude Code
		const isInsideClaudeCode = !!(process.env.CLAUDECODE || process.env.CLAUDE_CODE_ENTRYPOINT);
		
		if (isInsideClaudeCode) {
			console.log('[AuthManager] Running inside Claude Code - prioritizing Claude Code bridge for all operations');
		}

		// Define priority order - Always prefer Claude Code CLI first
		// This ensures maximum routing through Claude Code integration
		const providerPriority = this.preferredProvider 
			? [this.preferredProvider, 'claude-code-cli', 'claude-session', 'api-key']
			: ['claude-code-cli', 'claude-session', 'api-key'];

		// Special case: If explicitly requesting API key fallback, respect that
		if (this.preferredProviderType === 'api-key') {
			console.log('[AuthManager] Explicit API key preference - using direct API access');
		} else {
			console.log('[AuthManager] Prioritizing Claude Code bridge for LLM operations');
		}

		// Select the first available provider from priority list
		for (const providerType of providerPriority) {
			const provider = this.providers.get(providerType);
			if (provider) {
				try {
					const isHealthy = await provider.isValid?.() ?? true;
					if (isHealthy) {
						this.activeProvider = provider;
						this.activeProviderType = providerType;
						console.log(`[AuthManager] Using ${providerType} provider${isInsideClaudeCode ? ' (Claude Code handles AI operations)' : ''}`);
						return;
					} else {
						console.warn(`[AuthManager] Provider ${providerType} is not healthy, trying next option`);
					}
				} catch (error) {
					console.warn(`[AuthManager] Provider ${providerType} validation failed:`, error.message);
				}
			}
		}

		// If no provider is available, throw error
		throw new Error('No healthy authentication provider available');
	}

	async switchProvider(providerType) {
		if (!this.providers.has(providerType)) {
			throw new Error(`Provider type '${providerType}' not available`);
		}

		const provider = this.providers.get(providerType);
		if (!await provider.isValid()) {
			throw new Error(`Provider '${providerType}' is not valid`);
		}

		this.activeProvider = provider;
		this.preferredProviderType = providerType;
		
		console.log(`[AuthManager] Switched to provider: ${providerType}`);
	}

	async inference(options) {
		await this._ensureActiveProvider();
		return await this.activeProvider.inference(options);
	}

	async vectorize(options) {
		await this._ensureActiveProvider();
		return await this.activeProvider.vectorize(options);
	}

	async transcribe(options) {
		await this._ensureActiveProvider();
		return await this.activeProvider.transcribe(options);
	}

	async _ensureActiveProvider() {
		if (!this.activeProvider) {
			throw new Error('No active authentication provider');
		}

		// Check if current provider is still valid
		if (!await this.activeProvider.isValid()) {
			console.warn(`[AuthManager] Active provider ${this.activeProvider.constructor.name} is no longer valid`);
			
			if (this.fallbackEnabled) {
				await this._selectActiveProvider();
			} else {
				throw new Error('Active provider is no longer valid and fallback is disabled');
			}
		}
	}

	getProviderInfo() {
		const info = {
			activeProvider: this.activeProvider?.constructor.name || null,
			preferredProvider: this.preferredProviderType,
			fallbackEnabled: this.fallbackEnabled,
			initialized: this.initialized,
			providers: {}
		};

		for (const [type, provider] of this.providers) {
			info.providers[type] = provider.getInfo();
		}

		return info;
	}

	async refreshProviders() {
		// Re-validate all providers
		for (const [type, provider] of this.providers) {
			try {
				await provider.authenticate();
			} catch (error) {
				console.warn(`[AuthManager] Provider ${type} refresh failed:`, error.message);
			}
		}

		// Re-select active provider if current one is invalid
		if (!await this.activeProvider?.isValid()) {
			await this._selectActiveProvider();
		}
	}

	getAvailableProviders() {
		return Array.from(this.providers.keys());
	}

	async isHealthy() {
		if (!this.initialized) {
			return false;
		}

		if (!this.activeProvider) {
			return false;
		}

		return await this.activeProvider.isValid();
	}

	// Backward compatibility methods for existing code
	static async createCompatibleInstance() {
		const manager = new AuthManager();
		await manager.initialize();
		
		// Return object that matches existing utils interface
		return {
			inference: manager.inference.bind(manager),
			vectorize: manager.vectorize.bind(manager),
			transcribe: manager.transcribe.bind(manager),
			getProviderInfo: manager.getProviderInfo.bind(manager),
			isHealthy: manager.isHealthy.bind(manager),
		};
	}
}

export default AuthManager;