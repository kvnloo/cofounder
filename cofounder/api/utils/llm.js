import { AuthManager } from './auth/manager.js';

/**
 * Unified LLM Interface
 * 
 * Provides a unified interface for LLM operations across different authentication providers
 * This maintains backward compatibility while adding new authentication methods
 */
class LLMService {
	constructor() {
		this.authManager = null;
		this.initialized = false;
	}

	async initialize() {
		if (this.initialized) {
			return;
		}

		try {
			this.authManager = new AuthManager();
			await this.authManager.initialize();
			this.initialized = true;
			
			console.log('[LLMService] Initialized successfully');
		} catch (error) {
			console.error('[LLMService] Initialization failed:', error);
			throw error;
		}
	}

	async inference({ model = 'claude-3-5-sonnet-20240620', messages, stream = process.stdout }) {
		await this._ensureInitialized();
		return await this.authManager.inference({ model, messages, stream });
	}

	async vectorize({ texts, model = 'text-embedding-3-small' }) {
		await this._ensureInitialized();
		return await this.authManager.vectorize({ texts, model });
	}

	async transcribe({ path }) {
		await this._ensureInitialized();
		return await this.authManager.transcribe({ path });
	}

	async switchProvider(providerType) {
		await this._ensureInitialized();
		return await this.authManager.switchProvider(providerType);
	}

	getProviderInfo() {
		if (!this.initialized) {
			return { initialized: false };
		}
		return this.authManager.getProviderInfo();
	}

	async isHealthy() {
		if (!this.initialized) {
			return false;
		}
		return await this.authManager.isHealthy();
	}

	async refreshProviders() {
		await this._ensureInitialized();
		return await this.authManager.refreshProviders();
	}

	getAvailableProviders() {
		if (!this.initialized) {
			return [];
		}
		return this.authManager.getAvailableProviders();
	}

	async _ensureInitialized() {
		if (!this.initialized) {
			await this.initialize();
		}
	}
}

// Create singleton instance
const llmService = new LLMService();

// Export functions for backward compatibility
export async function inference(options) {
	return await llmService.inference(options);
}

export async function vectorize(options) {
	return await llmService.vectorize(options);
}

export async function transcribe(options) {
	return await llmService.transcribe(options);
}

// Export service instance and management functions
export { llmService };

export async function switchProvider(providerType) {
	return await llmService.switchProvider(providerType);
}

export function getProviderInfo() {
	return llmService.getProviderInfo();
}

export async function isHealthy() {
	return await llmService.isHealthy();
}

export async function refreshProviders() {
	return await llmService.refreshProviders();
}

export function getAvailableProviders() {
	return llmService.getAvailableProviders();
}

// Default export for backward compatibility
export default {
	inference,
	vectorize,
	transcribe,
	switchProvider,
	getProviderInfo,
	isHealthy,
	refreshProviders,
	getAvailableProviders,
};