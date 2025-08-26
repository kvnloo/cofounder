#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import open from 'open';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

/**
 * Claude Code + Cofounder Unified Launcher
 * 
 * Launches both Claude Code and Cofounder together for integrated development
 */
class UnifiedLauncher {
	constructor() {
		this.claudeCodeProcess = null;
		this.cofounderProcess = null;
		this.claudeCodePort = process.env.CLAUDE_CODE_PORT || 3000;
		this.cofounderPort = process.env.PORT || 4200;
		this.claudeCodeDir = process.env.CLAUDE_CODE_DIR || path.join(__dirname, '../../../claude-code');
		this.isShuttingDown = false;
	}

	async launch() {
		console.log('🚀 Starting Claude Code + Cofounder Integration...\n');

		// Setup cleanup handlers
		this.setupCleanup();

		try {
			// Start Claude Code first
			await this.startClaudeCode();
			
			// Wait for Claude Code to be ready
			await this.waitForClaudeCode();
			
			// Start Cofounder
			await this.startCofounder();
			
			// Wait for Cofounder to be ready
			await this.waitForCofounder();
			
			// Open both dashboards
			await this.openDashboards();
			
			console.log('\n✅ Both services are running!');
			console.log(`📊 Claude Code: http://localhost:${this.claudeCodePort}`);
			console.log(`🎨 Cofounder: http://localhost:${this.cofounderPort}`);
			console.log('\nPress Ctrl+C to stop both services\n');
			
			// Keep the process alive
			await this.keepAlive();
			
		} catch (error) {
			console.error('❌ Launch failed:', error.message);
			await this.cleanup();
			process.exit(1);
		}
	}

	async startClaudeCode() {
		console.log('🔵 Starting Claude Code...');
		
		if (!fs.existsSync(this.claudeCodeDir)) {
			console.log('⚠️  Claude Code directory not found, assuming it\'s already running or available globally');
			return;
		}

		try {
			this.claudeCodeProcess = spawn('npm', ['start'], {
				cwd: this.claudeCodeDir,
				stdio: ['pipe', 'pipe', 'pipe'],
				env: {
					...process.env,
					PORT: this.claudeCodePort,
				}
			});

			this.claudeCodeProcess.stdout.on('data', (data) => {
				const output = data.toString();
				if (output.includes('error') || output.includes('Error')) {
					console.log(`🔵 Claude Code: ${output.trim()}`);
				}
			});

			this.claudeCodeProcess.stderr.on('data', (data) => {
				console.log(`🔵 Claude Code Error: ${data.toString().trim()}`);
			});

			this.claudeCodeProcess.on('exit', (code) => {
				if (!this.isShuttingDown) {
					console.log(`🔵 Claude Code exited with code ${code}`);
				}
			});

		} catch (error) {
			console.log('⚠️  Could not start Claude Code locally, assuming it\'s running elsewhere');
		}
	}

	async startCofounder() {
		console.log('🟠 Starting Cofounder...');
		
		// Set auth provider to claude-session for integration
		const env = {
			...process.env,
			AUTH_PROVIDER: 'claude-session',
			CLAUDE_CODE_PORT: this.claudeCodePort,
			PORT: this.cofounderPort,
		};

		this.cofounderProcess = spawn('npm', ['run', 'start'], {
			cwd: __dirname,
			stdio: ['pipe', 'pipe', 'pipe'],
			env
		});

		this.cofounderProcess.stdout.on('data', (data) => {
			const output = data.toString();
			console.log(`🟠 Cofounder: ${output.trim()}`);
		});

		this.cofounderProcess.stderr.on('data', (data) => {
			console.log(`🟠 Cofounder Error: ${data.toString().trim()}`);
		});

		this.cofounderProcess.on('exit', (code) => {
			if (!this.isShuttingDown) {
				console.log(`🟠 Cofounder exited with code ${code}`);
			}
		});
	}

	async waitForService(port, name, timeout = 30000) {
		console.log(`⏳ Waiting for ${name} to be ready on port ${port}...`);
		
		const start = Date.now();
		while (Date.now() - start < timeout) {
			try {
				const response = await fetch(`http://localhost:${port}/api/ping`);
				if (response.ok) {
					console.log(`✅ ${name} is ready!`);
					return;
				}
			} catch (error) {
				// Service not ready yet
			}
			await this.sleep(1000);
		}
		
		throw new Error(`${name} did not become ready within ${timeout}ms`);
	}

	async waitForClaudeCode() {
		// Try different endpoints that Claude Code might expose
		const endpoints = ['/api/ping', '/health', '/api/status', '/'];
		
		for (const endpoint of endpoints) {
			try {
				await this.waitForService(this.claudeCodePort, 'Claude Code');
				return;
			} catch (error) {
				continue;
			}
		}
		
		console.log('⚠️  Could not verify Claude Code status, continuing anyway...');
	}

	async waitForCofounder() {
		await this.waitForService(this.cofounderPort, 'Cofounder');
	}

	async openDashboards() {
		console.log('🌐 Opening dashboards...');
		
		// Small delay to ensure services are fully ready
		await this.sleep(2000);
		
		try {
			// Open Cofounder first (main dashboard)
			await open(`http://localhost:${this.cofounderPort}`);
			
			// Optional: open Claude Code as well
			if (process.env.OPEN_CLAUDE_CODE !== 'false') {
				await this.sleep(1000);
				await open(`http://localhost:${this.claudeCodePort}`);
			}
		} catch (error) {
			console.log('⚠️  Could not open browsers automatically:', error.message);
		}
	}

	setupCleanup() {
		const cleanup = async () => {
			if (this.isShuttingDown) return;
			this.isShuttingDown = true;
			
			console.log('\n🛑 Shutting down services...');
			await this.cleanup();
			process.exit(0);
		};

		process.on('SIGINT', cleanup);
		process.on('SIGTERM', cleanup);
		process.on('exit', cleanup);
	}

	async cleanup() {
		const promises = [];

		if (this.claudeCodeProcess && !this.claudeCodeProcess.killed) {
			console.log('🔵 Stopping Claude Code...');
			this.claudeCodeProcess.kill('SIGTERM');
			promises.push(this.waitForExit(this.claudeCodeProcess, 5000));
		}

		if (this.cofounderProcess && !this.cofounderProcess.killed) {
			console.log('🟠 Stopping Cofounder...');
			this.cofounderProcess.kill('SIGTERM');
			promises.push(this.waitForExit(this.cofounderProcess, 5000));
		}

		await Promise.all(promises);
		console.log('✅ Cleanup complete');
	}

	async waitForExit(process, timeout = 5000) {
		return new Promise((resolve) => {
			const timer = setTimeout(() => {
				if (!process.killed) {
					console.log('⚠️  Force killing process...');
					process.kill('SIGKILL');
				}
				resolve();
			}, timeout);

			process.on('exit', () => {
				clearTimeout(timer);
				resolve();
			});
		});
	}

	async keepAlive() {
		// Keep the process alive until manually stopped
		return new Promise(() => {});
	}

	sleep(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
	const launcher = new UnifiedLauncher();
	launcher.launch().catch(console.error);
}

export default UnifiedLauncher;