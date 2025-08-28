import utils from "@/utils/index.js";
import dotenv from "dotenv";
dotenv.config();

async function opLlmGen({ context, data }) {
	/* ;; op:LLM::GEN
		{model,messages,preparser,parser,...} -> { response , tokens (consumption) }

		in : ["model","messages","preparser","parser","query","stream"]
		out : ["generated","usage"]
	*/
	/*
		formats ;;
			preparser : async ({text}) -> generated
			parser : async ({generated,query})
	*/

	let { model, messages, preparser, parser, validate, query, stream } = data;
	const { project, operation, streams } = context;

	if (operation?.key && streams) {
		await streams.start({
			project,
			key: operation.key,
			meta: operation.meta,
		});
		stream = {
			write: async (data) => {
				streams.write({
					project,
					key: operation.key,
					data,
				});
			},
			cutoff: operation?.cutoff ? operation.cutoff : false,
		};
	}
	if (!stream) stream = process.stdout;

	if (process.env.COFOUNDER_NICKNAME?.length) {
		messages[0].content = `you are : ${process.env.COFOUNDER_NICKNAME}\n${messages[0].content}`;
	}

	if (!preparser) {
		preparser = async ({ text }) => {
			return { text };
		};
	} else if (preparser === `backticks`) {
		preparser = utils.parsers.extract.backticks; // most likely to be used
	}

	if (!parser) {
		parser = async ({ generated, query }) => {
			return generated.text;
		};
	} else if (parser === `yaml`) {
		parser = utils.parsers.parse.yaml;
	}

	// Use Claude Code integration first, then unified LLM service, then legacy providers
	let text, usage;
	
	// Try Claude Code integration first if available
	try {
		const { ClaudeCodeIntegration } = await import('../../../utils/claude-code-integration.js');
		const claudeCode = new ClaudeCodeIntegration();
		
		if (claudeCode.initialized || await claudeCode.initialize().catch(() => false)) {
			console.log('[op:LLM::GEN] Using Claude Code integration');
			
			// Convert messages to a prompt format for Claude Code
			const prompt = messages.map(msg => {
				if (msg.role === 'system') {
					return `System: ${msg.content}`;
				} else if (msg.role === 'user') {
					return `User: ${msg.content}`;
				} else if (msg.role === 'assistant') {
					return `Assistant: ${msg.content}`;
				}
				return msg.content;
			}).join('\n\n');

			const result = await claudeCode.executeCommand(
				['--dangerously-skip-permissions', prompt],
				{ 
					model: model,
					stream: stream === process.stdout ? false : !!stream // Convert stream to boolean
				}
			);

			text = result.output || result;
			usage = result.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
		} else {
			throw new Error('Claude Code integration not available');
		}
	} catch (claudeError) {
		console.warn('[op:LLM::GEN] Claude Code integration failed, falling back to unified LLM service:', claudeError.message);
		
		// Fallback to unified LLM service
		try {
			const result = await utils.llm.inference({
				model: model,
				messages,
				stream,
			});
			text = result.text;
			usage = result.usage;
		} catch (error) {
			console.warn('[op:LLM::GEN] Unified LLM service failed, falling back to legacy providers:', error.message);
			
			// Final fallback to legacy provider selection
			const llm_fn = !process.env.LLM_PROVIDER
				? utils.openai.inference
				: process.env.LLM_PROVIDER.toLowerCase() === "openai"
					? utils.openai.inference
					: utils.anthropic.inference;

			const result = await llm_fn({
				model: model,
				messages,
				stream,
			});
			text = result.text;
			usage = result.usage;
		}
	}

	if (operation && streams) {
		await streams.end({
			project,
			key: operation.key,
		});
	}

	const generated_pre = await preparser({ text }); // -> typically { text : "... extracted text ..." }
	const generated_post = await parser({
		generated: generated_pre,
		query,
	});

	if (validate) {
		try {
			await validate({ generated: generated_post });
		} catch (e) {
			console.dir({ "op:LLM::GEN error": e });
			throw new Error(e);
		}
	}

	return {
		generated: generated_post,
		usage,
	};
}

function chunkify(array, chunkSize) {
	const chunks = [];
	for (let i = 0; i < array.length; i += chunkSize) {
		chunks.push(array.slice(i, i + chunkSize));
	}
	return chunks;
}

async function opLlmVectorizeChunk({ context, data }) {
	/* ;; op:LLM::VECTORIZE:CHUNK
		{texts} -> {vectors,usage}
		chunk processor (batches of 20)
		queue concurrency/lims defined for this one
	*/
	const { texts } = data;
	
	// Try Claude Code integration first if available
	try {
		const { ClaudeCodeIntegration } = await import('../../../utils/claude-code-integration.js');
		const claudeCode = new ClaudeCodeIntegration();
		
		if (claudeCode.initialized || await claudeCode.initialize().catch(() => false)) {
			console.log('[op:LLM::VECTORIZE:CHUNK] Using Claude Code integration for vectorization');
			
			// Create a prompt for vectorization (Claude Code doesn't have direct vectorization, so we'll use embeddings via prompt)
			const prompt = `Generate vector embeddings for the following texts. Return as JSON array of numbers for each text:\n\nTexts:\n${texts.map((t, i) => `${i + 1}. ${t}`).join('\n')}`;
			
			const result = await claudeCode.executeCommand({
				args: ['--dangerously-skip-permissions', prompt],
			});
			
			// Note: This is a simplified approach - in practice, vectorization might need a specialized endpoint
			// For now, fall back to unified LLM service for vectorization
			throw new Error('Claude Code vectorization not implemented, using fallback');
		}
	} catch (claudeError) {
		console.warn('[op:LLM::VECTORIZE:CHUNK] Claude Code integration not available for vectorization, using unified LLM service:', claudeError.message);
	}
	
	// Fallback to unified LLM service, then OpenAI
	try {
		return await utils.llm.vectorize({ texts });
	} catch (error) {
		console.warn('[op:LLM::VECTORIZE:CHUNK] Unified LLM service failed, falling back to OpenAI:', error.message);
		return await utils.openai.vectorize({ texts });
	}
}
async function opLlmVectorize({ context, data }) {
	/* ;; op:LLM::VECTORIZE
		{texts} -> {vectors,usage}

		chunkify, process, flatten, return
	*/
	const { texts } = data;
	const chunks = chunkify(texts, 20);
	let usageAll = { prompt_tokens: 0, total_tokens: 0 };
	const vectorsAll = (
		await Promise.all(
			chunks.map(async (chunk) => {
				const { vectors, usage } = await context.run({
					id: `op:LLM::VECTORIZE:CHUNK`,
					context,
					data: { texts: chunk },
				});
				usageAll.prompt_tokens += usage.prompt_tokens;
				usageAll.total_tokens += usage.total_tokens;
				return vectors;
			}),
		)
	).flat();
	return {
		vectors: vectorsAll,
		usage: usageAll,
	};
}

async function opLlmDebugSimulate({ context, data }) {
	/*
		debug : simulate a stream
	*/
	const { project, operation } = context;

	console.dir(
		{
			opLlmDebugSimulate: { context, data },
		},
		{ depth: null },
	);

	const text_demo = `
# Deleuze & Guattari

Gilles Deleuze (1925-1995) was a French philosopher known for his influential works in metaphysics, aesthetics, and political theory. His ideas have significantly impacted various fields, including literature, film, and art.

## Key Concepts

### Rhizome
Deleuze, along with Félix Guattari, introduced the concept of the **rhizome** in their work *A Thousand Plateaus*. Unlike traditional tree-like structures of knowledge, a rhizome represents a non-hierarchical and interconnected model of thought. It emphasizes multiplicity and the idea that any point can connect to any other point.

### Difference and Repetition
In his book *Difference and Repetition*, Deleuze challenges the notion of identity and sameness. He argues that difference is fundamental to understanding reality, and repetition is not merely a return of the same but a process that produces new meanings.

### Becoming
Deleuze's notion of **becoming** refers to the process of transformation and change. It suggests that identity is not fixed but is always in a state of flux, influenced by various factors and experiences.

## Conclusion
Deleuze's philosophy encourages us to think beyond binary oppositions and embrace complexity. His work continues to inspire contemporary thought and artistic practices, making him a pivotal figure in modern philosophy.
	`;

	await context.streams.start({
		project,
		key: operation.key,
		meta: operation.meta,
	});
	const chunkSize = 20; // Define the size of each chunk
	let currentIndex = 0;

	while (currentIndex < text_demo.length) {
		const data = text_demo.slice(currentIndex, currentIndex + chunkSize); // send chunk by chunk
		context.streams.write({
			project,
			key: operation.key,
			data,
		});
		currentIndex += chunkSize; // Move to the next chunk
		await new Promise((resolve) => setTimeout(resolve, 100)); // Delay chunk by chunk
	}

	await context.streams.end({
		project,
		key: operation.key,
	});

	return {
		generated: text_demo,
		usage: {},
	};
}
export default {
	"op:LLM::GEN": opLlmGen,
	"op:LLM::VECTORIZE": opLlmVectorize,
	"op:LLM::VECTORIZE:CHUNK": opLlmVectorizeChunk,

	"op:LLM::DEBUG:SIMULATE": opLlmDebugSimulate,
};
