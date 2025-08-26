import { AuthProvider } from './base.js';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

/**
 * API Key Authentication Provider
 * 
 * Uses direct API keys for OpenAI and Anthropic services
 * This maintains backward compatibility with existing setups
 */
export class ApiKeyProvider extends AuthProvider {
	constructor(config = {}) {
		super(config);
		this.openai = null;
		this.anthropic = null;
		this.supportedProviders = new Set(['openai', 'anthropic']);
	}

	async initialize(config = {}) {
		await super.initialize(config);
		
		try {
			// Initialize OpenAI if key is provided
			if (this.config.openaiApiKey) {
				this.openai = new OpenAI({
					apiKey: this.config.openaiApiKey,
				});
			}

			// Initialize Anthropic if key is provided
			if (this.config.anthropicApiKey) {
				this.anthropic = new Anthropic({
					apiKey: this.config.anthropicApiKey,
				});
			}

			if (!this.openai && !this.anthropic) {
				throw new Error('No API keys provided for OpenAI or Anthropic');
			}

		} catch (error) {
			this.handleError(error, 'initialization');
		}
	}

	async authenticate() {
		// API keys don't require explicit authentication
		// Validation happens on first request
		return true;
	}

	async isValid() {
		// For API keys, we assume they're valid unless we get an auth error
		// Could implement a lightweight test call here if needed
		return this.isInitialized && (this.openai || this.anthropic);
	}

	async inference({ model, messages, stream }) {
		try {
			// Determine provider based on model name
			const isOpenAI = model.includes('gpt') || model.includes('o1');
			const isAnthropic = model.includes('claude') || model.includes('sonnet') || model.includes('haiku') || model.includes('opus');

			if (isOpenAI && this.openai) {
				return await this._openaiInference({ model, messages, stream });
			} else if (isAnthropic && this.anthropic) {
				return await this._anthropicInference({ model, messages, stream });
			} else if (!isOpenAI && !isAnthropic) {
				// Default fallback logic
				if (this.anthropic) {
					return await this._anthropicInference({ model, messages, stream });
				} else if (this.openai) {
					return await this._openaiInference({ model, messages, stream });
				}
			}

			throw new Error(`No suitable provider for model: ${model}`);
		} catch (error) {
			this.handleError(error, 'inference');
		}
	}

	async _openaiInference({ model, messages, stream }) {
		const streaming = await this.openai.chat.completions.create({
			model,
			messages,
			stream: true,
			stream_options: { include_usage: true },
		});

		let text = "";
		let usage = {};
		let cutoff_reached = false;
		let chunks_buffer = "";
		let chunks_iterator = 0;
		const chunks_every = 5;

		for await (const chunk of streaming) {
			const content = chunk.choices[0]?.delta?.content || "";
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
			if (chunk.usage) usage = { ...chunk.usage };
		}
		stream.write(`\n`);

		return {
			text,
			usage: { model, ...usage },
		};
	}

	async _anthropicInference({ model, messages, stream }) {
		// Convert OpenAI format to Anthropic format
		const converted = await this._convertFromOpenaiFormat({ messages });
		const _model = model.includes("gpt") ? "claude-3-5-sonnet-20240620" : model;

		const streaming = await this.anthropic.messages.create({
			model: _model,
			stream: true,
			system: converted.system,
			max_tokens: 8192,
			messages: converted.messages,
		});

		let text = "";
		let usage = {};
		let cutoff_reached = false;
		let chunks_buffer = "";
		let chunks_iterator = 0;
		const chunks_every = 5;

		for await (const event of streaming) {
			if (
				event.type === "content_block_delta" &&
				event.delta.type === "text_delta"
			) {
				const content = event.delta.text;
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
			}
		}
		stream.write("\n");

		return {
			text,
			usage: { model: _model, ...usage },
		};
	}

	async _convertFromOpenaiFormat({ messages }) {
		const newMessages = (
			await Promise.all(
				messages.slice(1).map(async (m) => {
					if (typeof m.content === "string") {
						return [{ type: "text", text: m.content }];
					}
					return (
						await Promise.all(
							m.content.map(async (item) => {
								if (item.type === "text") return item;
								const { url } = item.image_url;
								if (url.includes(";base64,")) {
									return {
										type: "image",
										source: {
											type: "base64",
											media_type: url.split(";base64,")[0].split("data:")[1],
											data: url.split(";base64,")[1],
										},
									};
								}
								if (url.includes("http")) {
									const response = await fetch(url);
									const buffer = await response.arrayBuffer();
									const base64String = Buffer.from(buffer).toString("base64");
									const mediaType = response.headers.get("content-type");
									return {
										type: "image",
										source: {
											type: "base64",
											media_type: mediaType,
											data: base64String,
										},
									};
								}
								return false;
							}),
						)
					).filter((e) => e);
				}),
			)
		)
			.filter((e) => e)
			.flat();

		return {
			system: messages[0].content,
			messages: [
				{
					role: `user`,
					content: newMessages,
				},
			],
		};
	}

	async vectorize({ texts, model = 'text-embedding-3-small' }) {
		if (!this.openai) {
			throw new Error('OpenAI client required for vectorization');
		}

		try {
			const response = await this.openai.embeddings.create({
				model,
				input: texts,
				encoding_format: "float",
			});

			return {
				vectors: response.data
					.sort((a, b) => a.index - b.index)
					.map((e) => e.embedding),
				usage: { model, ...response.usage },
			};
		} catch (error) {
			this.handleError(error, 'vectorize');
		}
	}

	async transcribe({ path }) {
		if (!this.openai) {
			throw new Error('OpenAI client required for transcription');
		}

		try {
			const fs = await import('fs');
			const response = await this.openai.audio.transcriptions.create({
				file: fs.createReadStream(path),
				model: "whisper-1",
			});

			return {
				transcript: response.text,
			};
		} catch (error) {
			this.handleError(error, 'transcribe');
		}
	}
}

export default ApiKeyProvider;