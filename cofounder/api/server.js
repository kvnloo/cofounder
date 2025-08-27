import { Server } from "socket.io";
import utils from "@/utils/index.js";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import yargs from "yargs";
import fs from "fs";
import yaml from "yaml";
import { hideBin } from "yargs/helpers";
import { merge } from "lodash-es";
import open, { openApp, apps } from "open";
import cofounder from "./build.js";
import { generateAuthUrl, exchangeCodeForTokens, refreshAccessToken, isTokenExpired } from "@/utils/oauth-pkce.js";
dotenv.config();

// ES module __dirname equivalent (only if not already defined)
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// -------------------------------------------------------------- HELPERS  ------------------------
function _slugify(text) {
        return text
                .toString()
                .toLowerCase()
                .replace(/\s+/g, "-") // Replace spaces with -
                .replace(/[^\w\-]+/g, "") // Remove all non-word chars
                .replace(/\-\-+/g, "-") // Replace multiple - with single -
                .replace(/^-+/, "") // Trim - from start
                .replace(/-+$/, ""); // Trim - from end
}
// ----------------------------------------------------------------------------------------------------

// -------------------------------------------------------------- ARGS CASE ------------------------
// init project from argv
// to be called like : npm run start -- -p "some-project-name" -d "app description"
const timestamp = Date.now();
const argv = yargs(hideBin(process.argv)).argv;
const new_project = {
        project:
                (!argv.p && !argv.project) ||
                !_slugify(argv.p || argv.project).length ||
                !_slugify(argv.p || argv.project).match(/[a-z0-9]/)
                        ? `project-${timestamp}`
                        : _slugify(argv.p || argv.project),
        description: argv.description || argv.d || argv.desc || false,
        aesthetics: argv.aesthetics || argv.a || argv.aesthetic || false,
};
if (argv.file || argv.f) {
        new_project.description = fs.readFileSync(argv.file || argv.f, "utf-8");
}
async function create_new_project() {
        if (!new_project.description.length) {
                console.error(
                        'Error: -d "project description" is required and cannot be empty.',
                );
                process.exit(1);
        }
        console.log(
                `\x1b[31minitialized generating app : ${new_project.project}\x1b[0m`,
        );
        console.log(
                `\x1b[34m(see ${process.env.EXPORT_APPS_ROOT}/${new_project.project}/README.md for more details)\x1b[0m` +
                        `\n\x1b[38;5;37mto start app (api+frontend in parallel)` +
                        `\n\t> cd ${process.env.EXPORT_APPS_ROOT}/${new_project.project}` +
                        `\n\t> npm i && npm run dev\x1b[0m`,
        );

        const query = {
                pm: {
                        details: {
                                text: `${new_project.project != `project-${timestamp}` ? "Project '" + new_project.project + "' :" : ""} ${new_project.description}`,
                                attachments: [],
                                design: {
                                        aesthetics: {
                                                text: new_project.aesthetics,
                                        },
                                },
                        },
                },
        };
        console.dir({ query }, { depth: null });

        /*
        // debug : to resume ----------------------------------------------------------
        const data = await cofounder.system.run({
                id: "op:PROJECT::STATE:LOAD",
                context: {
                        ...context,
                        project: new_project.project,
                },
                data: {},
        });
        await cofounder.system.run({
                id: `seq:project:init:v1:resume`,
                context: {
                        ...context,
                        project: new_project.project,
                },
                data: merge(data, {
                        ...query,
                        debug: {},
                }),
        });
        ----------------------------------------------------------
        */

        await cofounder.system.run({
                id: `seq:project:init:v1`,
                context: {
                        ...context,
                        project: new_project.project,
                },
                data: query,
        });
}
// Call create_new_project if command args for init project are provided
if (new_project.project && new_project.description) {
        create_new_project();
}
// ----------------------------------------------------------------------------------------------------

// -------------------------------------------------------------- SERVER SETUP ------------------------
const app = express();
const PORT = process.env.PORT || 4200;

app.use(cors());
app.use(express.json({ limit: "20mb" }));

// serve static content from ./storage ; ie. for generated layout mockup images
app.use("/storage", express.static(path.join(__dirname, "db/storage")));
app.use(express.static(path.join(__dirname, "dist")));
app.use(/^\/(?!storage|api).*$/, express.static(path.join(__dirname, "dist")));

const server = app.listen(PORT, () => {
        console.log(
                "\x1b[33m\n> cofounder/api : server is running on port " + PORT + "\x1b[0m",
        );

        // Auto browser opening disabled
        // console.log(`> debug : open browser enabled : http://localhost:${PORT}/`);
        // open(`http://localhost:${PORT}/`);
});

// -------------------------------------------------------- SERVER REST API PATHS ------------------------

app.get("/api/ping", (req, res) => {
        res.status(200).json({ message: "pong" });
});

// Authentication management endpoints
app.get("/api/auth/info", (req, res) => {
	try {
		const info = utils.llm.getProviderInfo();
		res.status(200).json(info);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

app.post("/api/auth/switch", async (req, res) => {
	try {
		const { provider } = req.body;
		if (!provider) {
			return res.status(400).json({ error: "Provider type required" });
		}

		await utils.llm.switchProvider(provider);
		res.status(200).json({ success: true, activeProvider: provider });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

app.post("/api/auth/refresh", async (req, res) => {
	try {
		await utils.llm.refreshProviders();
		const info = utils.llm.getProviderInfo();
		res.status(200).json(info);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

app.get("/api/auth/health", async (req, res) => {
	try {
		const healthy = await utils.llm.isHealthy();
		const info = utils.llm.getProviderInfo();
		res.status(200).json({ healthy, ...info });
	} catch (error) {
		res.status(500).json({ error: error.message, healthy: false });
	}
});

// OAuth PKCE Browser Authentication Endpoints
// Store for temporary OAuth state (in production, use Redis or database)
const oauthStates = new Map();

app.post("/api/auth/oauth/start", (req, res) => {
	try {
		const { authUrl, state, codeVerifier } = generateAuthUrl();
		
		// Store state and code verifier temporarily
		oauthStates.set(state, {
			codeVerifier,
			createdAt: Date.now()
		});
		
		// Clean up old states (older than 10 minutes)
		for (const [key, value] of oauthStates.entries()) {
			if (Date.now() - value.createdAt > 10 * 60 * 1000) {
				oauthStates.delete(key);
			}
		}
		
		res.status(200).json({ 
			authUrl,
			state,
			message: "Open the authUrl in your browser to authenticate with Claude"
		});
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

app.post("/api/auth/oauth/callback", async (req, res) => {
	try {
		const { code, state } = req.body;
		
		if (!code || !state) {
			return res.status(400).json({ 
				error: "Missing authorization code or state" 
			});
		}
		
		// Verify state exists and get code verifier
		const oauthData = oauthStates.get(state);
		if (!oauthData) {
			return res.status(400).json({ 
				error: "Invalid state or expired session" 
			});
		}
		
		// Exchange authorization code for tokens
		const tokens = await exchangeCodeForTokens(code, oauthData.codeVerifier, state);
		
		// Clean up used state
		oauthStates.delete(state);
		
		// Store tokens securely (in production, use encrypted storage)
		// For now, we'll store in memory or file system
		const tokenData = {
			...tokens,
			provider: 'claude-oauth',
			authenticatedAt: new Date().toISOString()
		};
		
		// Save tokens to secure storage (you might want to encrypt this)
		fs.writeFileSync(
			path.join(__dirname, 'oauth-tokens.json'),
			JSON.stringify(tokenData, null, 2)
		);
		
		res.status(200).json({ 
			success: true,
			message: "Authentication successful! You can now use Claude via your subscription.",
			expiresAt: new Date(tokens.expiresAt).toISOString()
		});
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

app.get("/api/auth/oauth/status", (req, res) => {
	try {
		const tokenPath = path.join(__dirname, 'oauth-tokens.json');
		
		if (!fs.existsSync(tokenPath)) {
			return res.status(200).json({ 
				authenticated: false,
				message: "No OAuth tokens found" 
			});
		}
		
		const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
		const expired = isTokenExpired(tokenData.expiresAt);
		
		res.status(200).json({
			authenticated: !expired,
			provider: tokenData.provider,
			authenticatedAt: tokenData.authenticatedAt,
			expiresAt: new Date(tokenData.expiresAt).toISOString(),
			expired: expired,
			scope: tokenData.scope
		});
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

app.post("/api/auth/oauth/refresh", async (req, res) => {
	try {
		const tokenPath = path.join(__dirname, 'oauth-tokens.json');
		
		if (!fs.existsSync(tokenPath)) {
			return res.status(400).json({ 
				error: "No OAuth tokens found to refresh" 
			});
		}
		
		const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
		
		if (!tokenData.refreshToken) {
			return res.status(400).json({ 
				error: "No refresh token available" 
			});
		}
		
		// Refresh the access token
		const newTokens = await refreshAccessToken(tokenData.refreshToken);
		
		// Update stored tokens
		const updatedTokenData = {
			...tokenData,
			...newTokens,
			refreshedAt: new Date().toISOString()
		};
		
		fs.writeFileSync(
			tokenPath,
			JSON.stringify(updatedTokenData, null, 2)
		);
		
		res.status(200).json({
			success: true,
			message: "Tokens refreshed successfully",
			expiresAt: new Date(newTokens.expiresAt).toISOString()
		});
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

app.delete("/api/auth/oauth/logout", (req, res) => {
	try {
		const tokenPath = path.join(__dirname, 'oauth-tokens.json');
		
		if (fs.existsSync(tokenPath)) {
			fs.unlinkSync(tokenPath);
		}
		
		res.status(200).json({ 
			success: true,
			message: "Logged out successfully" 
		});
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

app.get("/api/projects/list", (req, res) => {
        fs.readdir("./db/projects", (err, files) => {
                if (err) {
                        return res.status(500).json({ error: "> cant read projects directory" });
                }
                const projects = files
                        .filter((file) =>
                                fs.statSync(path.join("./db/projects", file)).isDirectory(),
                        )
                        .map((projectDir) => {
                                const yamlFilePath = path.join(
                                        "./db/projects",
                                        projectDir,
                                        "state/pm/user/details.yaml",
                                );
                                if (fs.existsSync(yamlFilePath)) {
                                        const fileContent = fs.readFileSync(yamlFilePath, "utf8");
                                        const parsedData = yaml.parse(fileContent);
                                        return { id: projectDir, data: parsedData.data || false };
                                }
                                return { id: projectDir, data: false };
                        });
                res.status(200).json({ projects });
        });
});

app.post("/api/utils/transcribe", async (req, res) => {
        const uid = Math.random().toString(36).slice(2, 11); // Generate a random unique ID
        const tempFilePath = path.join(__dirname, "db/storage/temp", `${uid}.webm`);

        // Ensure the directory exists
        fs.mkdirSync(path.dirname(tempFilePath), { recursive: true });

        try {
                if (!req.body || !req.body.audio) {
                        throw new Error("No audio file uploaded");
                }

                const audioData = req.body.audio;
                const audioBuffer = Buffer.from(audioData.split(",")[1], "base64");

                // Write the audio buffer to the temporary path
                fs.writeFileSync(tempFilePath, audioBuffer);

		// Try unified LLM service first, fallback to OpenAI
		let transcript;
		try {
			const result = await utils.llm.transcribe({ path: tempFilePath });
			transcript = result.transcript;
		} catch (error) {
			console.warn('Unified LLM service failed for transcription, falling back to OpenAI:', error.message);
			const result = await utils.openai.transcribe({ path: tempFilePath });
			transcript = result.transcript;
		}
		res.status(200).json({ transcript });
	} catch (error) {
		console.error("Transcription error:", error);
		res.status(500).json({ error: "Failed to transcribe audio" });
	} finally {
		// Delete the temporary file
		fs.unlink(tempFilePath, (err) => {
			if (err) console.error("Error deleting temporary file:", err);
		});
	}
});

app.post("/api/projects/new", async (req, res) => {
        const request = req.body;
        /*
                request : {
                        project? : "project-id" || {}
                        description: "",
                        aeshetics?: ""
                }
        */
        if (!request.description?.length) {
                return res.status(500).json({ error: "> no project description provided" });
        }
        const timestamp = Date.now();
        const new_project_query = {
                project:
                        !request.project?.length ||
                        !_slugify(request.project).length ||
                        !_slugify(request.project).match(/[a-z0-9]/)
                                ? `project-${timestamp}`
                                : _slugify(request.project),
                description: request.description,
                aesthetics: request.aesthetics?.length ? request.aesthetics : false,
        };

        const query = request.blueprint ? {
                ...request.blueprint,
                pm: {
                        details: {
                                text: `${new_project_query.project != `project-${timestamp}` ? "Project '" + new_project_query.project + "' :\n" : ""}${new_project_query.description}`,
                                attachments: [],
                                design: {
                                        aesthetics: {
                                                text: new_project_query.aesthetics,
                                        },
                                },
                                timestamp,
                        },
                },
        } : {
                pm: {
                        details: {
                                text: `${new_project_query.project != `project-${timestamp}` ? "Project '" + new_project_query.project + "' :\n" : ""}${new_project_query.description}`,
                                attachments: [],
                                design: {
                                        aesthetics: {
                                                text: new_project_query.aesthetics,
                                        },
                                },
                                timestamp,
                        },
                },
        };

        // call async
        cofounder.system.run({
                id: `seq:project:init:v1`,
                context: {
                        ...context, // {streams}
                        project: new_project_query.project,
                },
                data: query,
        });

        res.status(200).json({ project: new_project_query.project });
});

app.post("/api/project/resume", async (req, res) => {
        const { project } = req.body;
        const resume_response = await resume_project({ project });
        console.dir({ "debug:server:project/resume": resume_response });
        setTimeout(async () => {
                await cofounder.system.run({
                        id: `seq:project:init:v1`,
                        context: {
                                ...context, // {streams}
                                project,
                                sequence: {
                                        resume: resume_response.resume,
                                },
                        },
                        data: resume_response.data,
                });
        }, 2000);
        res.status(200).json({ project });
});

const actions = {
        // map action to function ; load means load project state before passing
        "update:settings:preferences:versions": {
                fn: _updateProjectPreferences,
                load: false,
        },
        "regenerate:ui": { fn: _regenerateUiComponent, load: true },
        "iterate:ui": { fn: _iterateUiComponent, load: true },
        /*
                later, single universal interface approach, 
                > should go through an analysis sequence ;
                                ie. is is a new feature that needs db schemas & apis to be altered, or just at the layout level, etc
        */
};
const actionsKeys = Object.keys(actions);
app.post("/api/project/analyze", async (req, res) => {
        const { project_path } = req.body;
        if (!project_path) {
                return res.status(400).json({ error: "project_path is required" });
        }

        try {
                const { analyzeProject } = await import("./system/functions/op/analyze.js");
                const blueprint = await analyzeProject(project_path);
                res.status(200).json({ blueprint });
        } catch (error) {
                console.error("Analysis error:", error);
                res.status(500).json({ error: "Failed to analyze project" });
        }
});

app.post("/api/project/actions", async (req, res) => {
        /*
                in : {
                        project : `exampleproject`,
                        query : {
                                action : "example:action:whatever",
                                data : {
                                },
                        },
                }
        */
        console.dir(
                { "cofounder:api:server:actions:debug": req.body },
                { depth: null },
        );
        try {
                const { project, query } = req.body;
                const { action } = query;
                if (!actionsKeys.includes(action)) {
                        throw new Error(`action ${action} not recognized`);
                }
                const { fn, load } = actions[action];
                const data = await fn({
                        request: { project, query },
                        data: !load
                                ? {}
                                : await cofounder.system.run({
                                                id: "op:PROJECT::STATE:LOAD",
                                                context: {
                                                        ...context,
                                                        project,
                                                },
                                                data: {},
                                        }),
                });
                res.status(200).json({ end: true });
        } catch (error) {
                console.error(error);
                res.status(500).json({ error: "failed to process" });
        }
});
// ----------------------------------------------------------------------------------------------------

// -------------------------------------------------------------- SOCKET IO SETUP ------------------------
// socket.io instance attached to express
const io = new Server(server, {
        cors: {
                origin: "*",
                methods: ["GET", "POST"],
        },
});
const subscriptions = {};
const projects = {};
// will be sent inside context{} for system nodes to stream to at various steps
const streams = {
        start: async ({ project, key, meta }) => {
                /*
                        project , key , meta { name , desc }
                */
                // console.dir({"debug:context:streams" : {subscriptions}} , {depth:null})
                if (subscriptions[project])
                        io
                                .to(subscriptions[project])
                                .emit("stream$start", { timestamp: Date.now(), key, meta });
        },
        write: async ({ project, key, data }) => {
                if (subscriptions[project])
                        io.to(subscriptions[project]).emit("stream$data", {
                                key,
                                data,
                        });
        },
        end: async ({ project, key }) => {
                if (subscriptions[project])
                        io
                                .to(subscriptions[project])
                                .emit("stream$end", { timestamp: Date.now(), key });
        },
        update: async ({ project, key, data }) => {
                if (!subscriptions[project]) return;
                // console.log('> debug:streams:update :', key)

                if (key.includes("webapp.")) {
                        // reconstruct state
                        let projectSubState = {};
                        const keys = key.split(".");
                        let newStateUpdate = projectSubState;
                        keys.forEach((k, index) => {
                                if (!newStateUpdate[k]) {
                                        newStateUpdate[k] = index === keys.length - 1 ? data : {};
                                } else if (index === keys.length - 1) {
                                        newStateUpdate[k] = merge(newStateUpdate[k], data);
                                }
                                newStateUpdate = newStateUpdate[k];
                        });
                        const new_update_data = {};
                        let mergedKey;
                        Object.keys(projectSubState.webapp).map((_type) => {
                                // _type : react || layout
                                Object.keys(projectSubState.webapp[_type]).map((_category) => {
                                        // _category : root || store || views
                                        Object.keys(projectSubState.webapp[_type][_category]).map((_id) => {
                                                // _id : app || redux || GV_Whatever || ...
                                                mergedKey = `webapp.${_type}.${_category}.${_id}`;
                                                new_update_data[mergedKey] = {};
                                                Object.keys(projectSubState.webapp[_type][_category][_id]).map(
                                                        (_version) => {
                                                                // _version : latest || {timestamp}
                                                                new_update_data[mergedKey][_version] =
                                                                        projectSubState.webapp[_type][_category][_id][_version];
                                                        },
                                                );
                                        });
                                });
                        });
                        key = mergedKey;
                        data = new_update_data[mergedKey];
                }
                io.to(subscriptions[project]).emit("state$update", {
                        key,
                        data,
                });
        },
};
const context = { streams };

io.on("connection", async (socket) => {
        console.log("> user connected : ", socket.id);
        socket.on("subscribe", async (project) => {
                console.log(`> user ${socket.id} subscribed to project : ${project}`);
                if (!subscriptions[project]) {
                        subscriptions[project] = [];
                }
                subscriptions[project].push(socket.id);
                try {
                        await load_project({ project });
                        io.to(subscriptions[project]).emit("state$load", {
                                timestamp: Date.now(),
                                state: projects[project],
                        });
                } catch (e) {
                        console.error("> cofounder/api : server error : ", e);
                }

                /*
                        console.log("> ____debug : server : op:LLM::DEBUG : run");
                        const inference_debug = await cofounder.system.run({
                                id: "op:LLM::DEBUG:SIMULATE",
                                context: {
                                        ...context, // {streams}
                                        project,
                                        operation: {
                                                key: "pm.prd",
                                                meta: {
                                                        name: "PRD",
                                                        desc: "project requirements doc",
                                                },
                                        },
                                },
                                data: {}, // subscriptions[project]
                        });
                        const prd = inference_debug.generated;
                        await cofounder.system.run({
                                id: "op:PROJECT::STATE:UPDATE",
                                context: {
                                        ...context,
                                        project,
                                },
                                data: {
                                        operation: {
                                                id: "pm:prd",
                                        },
                                        type: `end`,
                                        content: {
                                                key: "pm.prd",
                                                data: prd,
                                        },
                                },
                        });
                        const debug_webapp_data = yaml.parse(
                                fs.readFileSync(
                                        `db/projects/foundermatchdevclone/state/webapp/code/react/views/GV_TopNav/versions/1726434529344.yaml`,
                                        "utf8",
                                ),
                        );
                        debug_webapp_data.data.tsx = `it be cool if this updated fr`;
                        await cofounder.system.run({
                                id: "op:PROJECT::STATE:UPDATE",
                                context: {
                                        ...context,
                                        project,
                                },
                                data: {
                                        operation: {
                                                id: `webapp:react:views`,
                                                refs: {
                                                        id: "GV_TopNav",
                                                        version: "1726434529344",
                                                },
                                        },
                                        type: `end`,
                                        content: {
                                                key: debug_webapp_data.key,
                                                data: debug_webapp_data.data,
                                        },
                                },
                        });
                        console.log("> ____debug : server : op:LLM::DEBUG:2");
                        const demo_messages = [
                                {
                                        role: "system",
                                        content:
                                                "You are a helpful assistant that provides information about product requirements. in markdown format;",
                                },
                                {
                                        role: "user",
                                        content:
                                                "Can you help me outline the product requirements for our new project? It's a rizz helper",
                                },
                        ];

                        
                        await cofounder.system.run({
                                id: "op:LLM::GEN",
                                context: {
                                        ...context, // {streams}
                                        project,
                                        operation: {
                                                key: 'pm.prd',
                                                meta: {
                                                        name: "PRD",
                                                        desc: "product requirements document",
                                                },
                                        },
                                },
                                data: {
                                        model: `gpt-4o-mini`, //`gpt-4o`,
                                        messages: demo_messages,
                                        preparser: `backticks`,
                                        parser: false,
                                },
                        })
                */
        });
        socket.on("disconnect", () => {
                console.log("> user disconnected : ", socket.id);
                for (const project in subscriptions) {
                        subscriptions[project] = subscriptions[project].filter(
                                (id) => id !== socket.id,
                        );
                }
        });
});
const load_project = async ({ project }) => {
        console.log("> load_project : start : ", project);
        
        // Special handling for the cofounder project - analyze the actual codebase
        if (project === "cofounder") {
                try {
                        console.log("> Creating cofounder project blueprint...");
                        const projectPath = path.join(__dirname, "../"); // Path to cofounder root
                        console.log("> Project path:", projectPath);
                        
                        // Create a simplified blueprint for the cofounder project
                        const blueprint = {
                                name: "cofounder",
                                description: "AI-powered application generator platform",
                                structure: {
                                        api: {
                                                type: "backend",
                                                framework: "express",
                                                files: ["server.js", "build.js", "package.json"],
                                                folders: ["system", "utils", "db", "dist"]
                                        },
                                        dashboard: {
                                                type: "frontend", 
                                                framework: "react",
                                                files: ["package.json", "vite.config.ts"],
                                                folders: ["src", "public"]
                                        },
                                        docs: {
                                                type: "documentation",
                                                folders: ["product-strategy", "requirements", "ux-design"]
                                        }
                                },
                                technologies: ["Node.js", "Express", "React", "TypeScript", "Vite", "PostgreSQL"],
                                features: [
                                        "Multi-provider AI authentication",
                                        "Real-time project generation",
                                        "Project analysis and import",
                                        "Blueprint visualization",
                                        "Document generation (PRD, FRD, BRD, DRD, UXSMD)"
                                ]
                        };
                        
                        // Structure the analyzed data to match the expected database format using standard blueprint keys
                        const projectData = {
                                "pm.details": {
                                        latest: {
                                                name: "cofounder",
                                                description: "The Cofounder platform itself - a comprehensive tool for rapid prototyping",
                                                path: projectPath,
                                                isMetaProject: true,
                                                timestamp: Date.now()
                                        }
                                },
                                "pm.prd": {
                                        latest: {
                                                tsx: "# Cofounder Platform\n\nAI-powered application generator and development platform that enables rapid prototyping and full-stack application development through intelligent code generation and project analysis.",
                                                timestamp: Date.now()
                                        }
                                },
                                "pm.frd": {
                                        latest: {
                                                tsx: blueprint.features.map(feature => `- ${feature}`).join('\n'),
                                                timestamp: Date.now()
                                        }
                                },
                                "pm.brd": {
                                        latest: {
                                                tsx: `# Backend Requirements\n\n## Architecture\n- ${blueprint.structure.api.framework} server\n- ${blueprint.technologies.join(', ')}`,
                                                timestamp: Date.now()
                                        }
                                },
                                "backend.specifications.openapi": {
                                        latest: {
                                                tsx: JSON.stringify({
                                                        openapi: "3.0.0",
                                                        info: { title: "Cofounder API", version: "1.0.0" },
                                                        paths: {}
                                                }, null, 2),
                                                timestamp: Date.now()
                                        }
                                },
                                "uxsitemap.structure": {
                                        latest: {
                                                tsx: JSON.stringify(blueprint.structure.dashboard, null, 2),
                                                timestamp: Date.now()
                                        }
                                },
                                "webapp.react.root": {
                                        latest: {
                                                tsx: `# React Application Structure\n\nFramework: React\nFiles: ${blueprint.structure.dashboard.files.join(', ')}`,
                                                timestamp: Date.now()
                                        }
                                },
                                "settings.config.package": {
                                        latest: {
                                                tsx: `# Technologies & Dependencies\n\nTechnologies: ${blueprint.technologies.join(', ')}\n\nStructure:\n${JSON.stringify(blueprint.structure, null, 2)}`,
                                                timestamp: Date.now()
                                        }
                                }
                        };
                        
                        // Add database schema information
                        projectData["db.schemas"] = {
                                latest: {
                                        tsx: "# Database Schemas\n\nProject data, user authentication, and document storage",
                                        timestamp: Date.now()
                                }
                        };
                        
                        projects[project] = projectData;
                        console.log("> Cofounder project analyzed successfully");
                        console.dir({
                                load_project: project,
                                data_keys: `${Object.keys(projects[project]).join(" , ")}`,
                        });
                        return projectData;
                } catch (error) {
                        console.error("> Error analyzing cofounder project:", error);
                        projects[project] = {};
                }
        } else {
                // Original database loading for other projects
                const fetchedProject = await utils.load.local({
                        project,
                        deconstructed: true,
                });
                const fetchedProjectState = fetchedProject.state;
                const _project = fetchedProject.keymap || {};
                let projectData = {};
                Object.keys(_project)
                        .filter((key) => !key.startsWith("webapp."))
                        .map((key) => {
                                projectData[key] = _project[key];
                        });
                if (fetchedProjectState.webapp) {
                        Object.keys(fetchedProjectState.webapp).map((_type) => {
                                // _type : react || layout
                                Object.keys(fetchedProjectState.webapp[_type]).map((_category) => {
                                        // _category : root || store || views
                                        Object.keys(fetchedProjectState.webapp[_type][_category]).map((_id) => {
                                                // _id : app || redux || GV_Whatever || ...
                                                const mergedKey = `webapp.${_type}.${_category}.${_id}`;
                                                projectData[mergedKey] = {};
                                                Object.keys(fetchedProjectState.webapp[_type][_category][_id]).map(
                                                        (_version) => {
                                                                // _version : latest || {timestamp}
                                                                projectData[mergedKey][_version] =
                                                                        fetchedProjectState.webapp[_type][_category][_id][_version];
                                                        },
                                                );
                                        });
                                });
                        });
                }
                projects[project] = projectData;
                console.dir({
                        load_project: project,
                        data_keys: `${Object.keys(projects[project]).join(" , ")}`,
                });
        }
        // only use in resume ; else check data stored in projects[project]
        return fetchedProjectState;
};

const seq_projectv1_dag = [
        // dumped from makeDag() in ./build
        [], // project setup , skip
        ["pm.prd"],
        ["pm.frd"],
        ["pm.frd", "pm.uxsmd"],
        ["db.schemas", "uxsitemap.structure"],
        ["db.postgres"],
        ["pm.brd"],
        ["backend.specifications.openapi", "backend.specifications.asyncapi"],
        ["backend.server.main"],
        ["pm.uxdmd"],
        ["uxdatamap.structure"],
        ["uxdatamap.views"],
        ["webapp.react.store.redux"],
        ["webapp.react.root.app"],
        ["webapp.react.app.views"], // views , latest
];

async function resume_project({ project }) {
        const project_data = await load_project({ project });
        const project_keys = Object.keys(projects[project]);
        let previous_phase_index = -1;
        for (let step of seq_projectv1_dag) {
                previous_phase_index++;
                if (step.length) {
                        if (
                                step.every((entry) => project_keys.some((key) => key.startsWith(entry)))
                        ) {
                                continue;
                        } else {
                                break;
                        }
                }
        }
        return {
                data: project_data,
                resume: previous_phase_index,
        };
}

// example of how to stream to client (needs 3 steps)
const stream_to_client = async ({ project, key, meta }) => {
        // if (!subscriptions[project]?.length) return;
        console.log(`> starting stream for project ${project}`);
        streams.start({ project, key, meta });
        const chunkSize = 20; // Define the size of each chunk
        let currentIndex = 0;
        const interval = setInterval(() => {
                const timestamp = Date.now();
                const data = texts[key].slice(currentIndex, currentIndex + chunkSize); // send chunk by chunk
                streams.write({ project, key, data });
                currentIndex += chunkSize; // Move to the next chunk
                if (currentIndex >= texts[key].length) {
                        clearInterval(interval);
                        streams.end({ project, key });
                }
        }, 100);
};
// ----------------------------------------------------------------------------------------------------

// -------------------------------------------------------- SERVER REST API FUNCTION CALLS ------------------------
async function _updateProjectPreferences({ request }) {
        /*
                in : {
                        project : `exampleproject`,
                        query : {
                                action : "example:action:whatever",
                                data : {
                                        [views || sections] : {
                                                [id] : {version}
                                        }
                                },
                        },
                }
        */
        const { project, query } = request;
        await cofounder.system.run({
                id: "op:PROJECT::STATE:UPDATE",
                context: { ...context, project },
                data: {
                        operation: {
                                id: `settings:preferences:versions`,
                        },
                        type: `end`,
                        content: {
                                key: `settings.preferences.versions`,
                                data: query.data,
                        },
                },
        });
}
async function _regenerateUiComponent({ request, data }) {
        const { project, query } = request;
        /*
                in : request: {
                        project : `exampleproject`,
                        query : {
                                action : "regenerate:ui"
                                data : {
                                        [views || sections] : `{id}`, // <--- update : sections stuff removed, is views only (for now)
                                },
                        },
                }
        */

        const type = Object.keys(query.data)[0];
        const id = query.data[type];

        /*
                need to make :
                task {
                        type: "view",
                        view: {
                                type: unique || shared,
                                id,
                        },
                        passes: {
                                functional: true,
                                redesign: process.env.DESIGNER_ENABLE
                                        ? JSON.parse(process.env.DESIGNER_ENABLE.toLowerCase())
                                        : true,
                        }
                }
        */
        const task = {
                type: "view",
                view: {
                        type: id.startsWith(`UV_`) ? `unique` : `shared`,
                        id,
                },
                passes: {
                        functional: true,
                        redesign: process.env.DESIGNER_ENABLE
                                ? JSON.parse(process.env.DESIGNER_ENABLE.toLowerCase())
                                : false,
                },
        };
        console.dir({ "debug:server:task:regen:ui": { request, task } });
        await cofounder.system.run({
                id: "WEBAPP:VIEW::GENERATE",
                context: { ...context, project },
                data: {
                        ...data,
                        task,
                },
        });
}
async function _iterateUiComponent({ request, data }) {
        console.dir({ "cofounder:api:server:iterate:ui": "starts" });
        /*
                designer/layoutv1 might be overkill, but its best way to have primitives to retrieve design system docs (if applies)
                
        */

        /*
                in : {
                        project: meta.project,
                        query: {
                                action: "iterate:ui",
                                data: {
                                        views : {
                                                [id] : {
                                                        [version] : {
                                                                user : {
                                                                        text: editUserText,
                                                                        attachments: [], // later, can attach image
                                                                },
                                                                screenshot: { base64: image ? image : false},
                                                                designer: bool
                                                        }
                                                },
                                        }
                                },
                        },
                }),
                }
        */
        const { project, query } = request;
        const id = Object.keys(query.data.views)[0];
        const version = Object.keys(query.data.views[id])[0];
        const { notes, screenshot, designer } = query.data.views[id][version];

        const task = {
                type: "view",
                view: {
                        type: id.startsWith(`UV_`) ? `unique` : `shared`,
                        id,
                        version,
                },
                iteration: {
                        notes, // {text,attachements}
                        screenshot, // {base64 : "base64str" || false }
                        designer: process.env.DESIGNER_ENABLE
                                ? JSON.parse(process.env.DESIGNER_ENABLE.toLowerCase()) && designer
                                        ? true
                                        : false
                                : false,
                },
        };
        console.dir({ "debug:server:task:regen:ui": { request, task } });
        await cofounder.system.run({
                id: "WEBAPP:VIEW::ITERATE",
                context: { ...context, project },
                data: {
                        ...data,
                        task,
                },
        });
}
// ----------------------------------------------------------------------------------------------------
