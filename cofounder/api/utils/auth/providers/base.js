/**
 * Base Authentication Provider Interface
 * 
 * All authentication providers must implement this interface
 */
export class AuthProvider {
	constructor(config = {}) {
		this.config = config;
		this.isInitialized = false;
		this.lastError = null;
	}

	/**
	 * Initialize the provider with configuration
	 * @param {Object} config - Provider-specific configuration
	 */
	async initialize(config = {}) {
		this.config = { ...this.config, ...config };
		this.isInitialized = true;
	}

	/**
	 * Authenticate and establish session if needed
	 * @returns {Promise<boolean>} - Authentication success
	 */
	async authenticate() {
		throw new Error("authenticate() must be implemented by provider");
	}

	/**
	 * Check if current authentication is valid
	 * @returns {Promise<boolean>} - Validation result
	 */
	async isValid() {
		throw new Error("isValid() must be implemented by provider");
	}

	/**
	 * Make an authenticated inference request
	 * @param {Object} options - Request options
	 * @param {string} options.model - Model name
	 * @param {Array} options.messages - Messages array
	 * @param {Object} options.stream - Stream options
	 * @returns {Promise<Object>} - Response with text and usage
	 */
	async inference(options) {
		throw new Error("inference() must be implemented by provider");
	}

	/**
	 * Make an authenticated vectorization request
	 * @param {Object} options - Request options
	 * @param {Array} options.texts - Texts to vectorize
	 * @param {string} options.model - Embedding model name
	 * @returns {Promise<Object>} - Response with vectors and usage
	 */
	async vectorize(options) {
		throw new Error("vectorize() must be implemented by provider");
	}

	/**
	 * Make an authenticated transcription request
	 * @param {Object} options - Request options
	 * @param {string} options.path - Audio file path
	 * @returns {Promise<Object>} - Response with transcript
	 */
	async transcribe(options) {
		throw new Error("transcribe() must be implemented by provider");
	}

	/**
	 * Get provider-specific information
	 * @returns {Object} - Provider info
	 */
	getInfo() {
		return {
			type: this.constructor.name,
			initialized: this.isInitialized,
			lastError: this.lastError,
			config: this.getSafeConfig()
		};
	}

	/**
	 * Get safe configuration (without sensitive data)
	 * @returns {Object} - Safe configuration
	 */
	getSafeConfig() {
		const safe = { ...this.config };
		// Remove sensitive keys
		['apiKey', 'token', 'session', 'secret'].forEach(key => {
			if (safe[key]) {
				safe[key] = '***';
			}
		});
		return safe;
	}

	/**
	 * Handle and log errors
	 * @param {Error} error - Error to handle
	 * @param {string} context - Error context
	 */
	handleError(error, context = '') {
		this.lastError = {
			message: error.message,
			context,
			timestamp: Date.now()
		};
		console.error(`[${this.constructor.name}] ${context}:`, error);
		throw error;
	}
}

export default AuthProvider;