#!/usr/bin/env node

import { AuthManager } from './utils/auth/manager.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Test script for the authentication system
 */
async function testAuth() {
	console.log('🧪 Testing Authentication System\n');

	try {
		// Test AuthManager initialization
		console.log('1. Initializing AuthManager...');
		const authManager = new AuthManager();
		await authManager.initialize();
		console.log('✅ AuthManager initialized successfully\n');

		// Get provider info
		console.log('2. Getting provider information...');
		const info = authManager.getProviderInfo();
		console.log('Provider Info:', JSON.stringify(info, null, 2));
		console.log('');

		// Test health check
		console.log('3. Testing health check...');
		const isHealthy = await authManager.isHealthy();
		console.log(`Health Status: ${isHealthy ? '✅ Healthy' : '❌ Unhealthy'}\n`);

		// Test available providers
		console.log('4. Available providers:');
		const providers = authManager.getAvailableProviders();
		providers.forEach(provider => {
			console.log(`   - ${provider}`);
		});
		console.log('');

		// Test a simple inference call (if healthy)
		if (isHealthy) {
			console.log('5. Testing inference call...');
			try {
				const result = await authManager.inference({
					model: 'claude-3-5-haiku-20241022',
					messages: [
						{ role: 'system', content: 'You are a helpful assistant.' },
						{ role: 'user', content: 'Say "Authentication test successful!" and nothing else.' }
					],
					stream: { write: (data) => process.stdout.write(data) }
				});
				console.log('✅ Inference test completed successfully');
				console.log('Response length:', result.text.length);
				console.log('Usage:', result.usage);
			} catch (error) {
				console.log('❌ Inference test failed:', error.message);
			}
		} else {
			console.log('5. Skipping inference test - system not healthy');
		}

		console.log('\n✅ Authentication system test completed!');
		
	} catch (error) {
		console.error('❌ Test failed:', error.message);
		if (error.stack) {
			console.error('Stack trace:', error.stack);
		}
		process.exit(1);
	}
}

// Run the test
testAuth();