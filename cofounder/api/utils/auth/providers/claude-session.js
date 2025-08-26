import { AuthProvider } from './base.js';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Claude Session Authentication Provider
 * 
 * Uses Claude Code's session token for authentication
 * Proxies requests through Claude Code's authenticated endpoints
 */
export class ClaudeSessionProvider extends AuthProvider {
	constructor(config = {}) {
		super(config);
		this.sessionToken = null;
		this.claudeCodePort = config.claudeCodePort || 3000;
		this.claudeCodeUrl = `http://localhost:${this.claudeCodePort}`;
		this.sessionPath = null;
	}

	async initialize(config = {}) {
		await super.initialize(config);
		
		try {
			// Find Claude Code session
			await this._findClaudeSession();
			
			if (!this.sessionToken) {
				throw new Error('Claude Code session not found. Make sure Claude Code is running and you are logged in.');
			}

			console.log(`[ClaudeSessionProvider] Initialized with session from ${this.sessionPath}`);
		} catch (error) {
			this.handleError(error, 'initialization');
		}
	}

	async _findClaudeSession() {
		// Try multiple common session file locations
		const possiblePaths = [
			// Custom path from config
			this.config.sessionPath,
			// Common Claude Code session locations
			path.join(os.homedir(), '.claude-code', 'session'),
			path.join(os.homedir(), '.claude', 'session'),
			path.join(os.homedir(), '.anthropic', 'claude-code', 'session'),
			// XDG config directory
			path.join(os.homedir(), '.config', 'claude-code', 'session'),
			// Application data directories
			process.platform === 'darwin' 
				? path.join(os.homedir(), 'Library', 'Application Support', 'claude-code', 'session')
				: path.join(os.homedir(), '.local', 'share', 'claude-code', 'session'),
		].filter(Boolean);

		for (const sessionPath of possiblePaths) {
			try {
				if (fs.existsSync(sessionPath)) {
					const sessionData = fs.readFileSync(sessionPath, 'utf8');
					const session = JSON.parse(sessionData);
					
					if (session.token || session.sessionToken || session.access_token) {
						this.sessionToken = session.token || session.sessionToken || session.access_token;
						this.sessionPath = sessionPath;
						return;
					}
				}
			} catch (error) {
				// Continue trying other paths
				console.debug(`[ClaudeSessionProvider] Could not read session from ${sessionPath}:`, error.message);
			}
		}

		// If no file found, try to get session from running Claude Code instance
		await this._getSessionFromClaudeCode();
	}

	async _getSessionFromClaudeCode() {
		try {
			// Try to ping Claude Code to see if it's running
			const response = await fetch(`${this.claudeCodeUrl}/api/session`, {
				timeout: 2000
			});

			if (response.ok) {
				const sessionData = await response.json();
				if (sessionData.token) {
					this.sessionToken = sessionData.token;
					console.log(`[ClaudeSessionProvider] Retrieved session from running Claude Code instance`);
				}
			}
		} catch (error) {
			console.debug(`[ClaudeSessionProvider] Could not connect to Claude Code at ${this.claudeCodeUrl}:`, error.message);
		}
	}

	async authenticate() {
		if (!this.sessionToken) {
			await this._findClaudeSession();
		}

		// Validate session by making a test request
		return await this.isValid();
	}

	async isValid() {
		if (!this.sessionToken) {
			return false;
		}

		try {
			// Test session validity with a lightweight request
			const response = await fetch(`${this.claudeCodeUrl}/api/auth/validate`, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${this.sessionToken}`,
					'Content-Type': 'application/json',
				},
				timeout: 5000
			});

			return response.ok;
		} catch (error) {
			console.debug(`[ClaudeSessionProvider] Session validation failed:`, error.message);
			return false;
		}
	}

	async inference({ model, messages, stream }) {
		if (!this.sessionToken) {
			throw new Error('No valid Claude session found');
		}

		try {
			// Proxy request through Claude Code
			const response = await fetch(`${this.claudeCodeUrl}/api/chat/completions`, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${this.sessionToken}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					model,
					messages,
					stream: true,
				}),
			});

			if (!response.ok) {
				throw new Error(`Claude Code API error: ${response.status} ${response.statusText}`);
			}

			return await this._handleStreamingResponse(response, stream);
		} catch (error) {
			this.handleError(error, 'inference');
		}
	}

	async _handleStreamingResponse(response, stream) {
		let text = "";
		let usage = {};
		let cutoff_reached = false;
		let chunks_buffer = "";
		let chunks_iterator = 0;
		const chunks_every = 5;

		// Handle streaming response
		const reader = response.body.getReader();
		const decoder = new TextDecoder();

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				const chunk = decoder.decode(value, { stream: true });
				const lines = chunk.split('\n').filter(line => line.trim());

				for (const line of lines) {
					if (line.startsWith('data: ')) {
						const data = line.slice(6);
						if (data === '[DONE]') break;

						try {
							const parsed = JSON.parse(data);
							const content = parsed.choices?.[0]?.delta?.content || '';
							
							if (content) {
								text += content;
								chunks_buffer += content;
								chunks_iterator++;

								if (stream?.cutoff) {
									if (!cutoff_reached && text.includes(stream.cutoff)) {
										cutoff_reached = true;
									}
								}

								if (!(chunks_iterator % chunks_every)) {
									stream.write(!cutoff_reached ? chunks_buffer : " ...");
									chunks_buffer = "";
								}
							}

							if (parsed.usage) {
								usage = { ...parsed.usage };
							}
						} catch (parseError) {
							console.debug('Failed to parse SSE data:', data);
						}
					}
				}
			}
		} finally {
			reader.releaseLock();
		}

		stream.write(`\n`);

		return {
			text,
			usage: { model, ...usage },
		};
	}

	async vectorize({ texts, model = 'text-embedding-3-small' }) {
		if (!this.sessionToken) {
			throw new Error('No valid Claude session found');
		}

		try {
			const response = await fetch(`${this.claudeCodeUrl}/api/embeddings`, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${this.sessionToken}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					model,
					input: texts,
					encoding_format: "float",
				}),
			});

			if (!response.ok) {
				throw new Error(`Claude Code API error: ${response.status} ${response.statusText}`);
			}

			const data = await response.json();
			
			return {
				vectors: data.data
					.sort((a, b) => a.index - b.index)
					.map((e) => e.embedding),
				usage: { model, ...data.usage },
			};
		} catch (error) {
			this.handleError(error, 'vectorize');
		}
	}

	async transcribe({ path }) {
		if (!this.sessionToken) {
			throw new Error('No valid Claude session found');
		}

		try {
			const FormData = (await import('form-data')).default;
			const form = new FormData();
			form.append('file', fs.createReadStream(path));
			form.append('model', 'whisper-1');

			const response = await fetch(`${this.claudeCodeUrl}/api/audio/transcriptions`, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${this.sessionToken}`,
					...form.getHeaders(),
				},
				body: form,
			});

			if (!response.ok) {
				throw new Error(`Claude Code API error: ${response.status} ${response.statusText}`);
			}

			const data = await response.json();
			
			return {
				transcript: data.text,
			};
		} catch (error) {
			this.handleError(error, 'transcribe');
		}
	}

	getSafeConfig() {
		const safe = super.getSafeConfig();
		return {
			...safe,
			sessionPath: this.sessionPath,
			claudeCodeUrl: this.claudeCodeUrl,
			hasSession: !!this.sessionToken,
		};
	}
}

export default ClaudeSessionProvider;