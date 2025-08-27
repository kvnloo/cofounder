#!/usr/bin/env node

import express from 'express';
import { spawn } from 'child_process';

const app = express();
app.use(express.json());

// Simple test endpoint
app.post('/test-claude', async (req, res) => {
    const { prompt } = req.body;
    
    console.log('Testing Claude bridge with prompt:', prompt);
    
    try {
        // Test 1: Simple args (current failing approach)
        console.log('\n=== Test 1: Simple args ===');
        const result1 = await testClaudeCommand(['-p', prompt]);
        console.log('Test 1 result:', result1);
        
        // Test 2: Quoted prompt
        console.log('\n=== Test 2: Quoted prompt ===');
        const result2 = await testClaudeCommand(['-p', `"${prompt}"`]);
        console.log('Test 2 result:', result2);
        
        // Test 3: Shell execution
        console.log('\n=== Test 3: Shell execution ===');
        const result3 = await testClaudeShell(`claude -p "${prompt}"`);
        console.log('Test 3 result:', result3);
        
        res.json({
            success: true,
            tests: {
                simple: result1,
                quoted: result2,
                shell: result3
            }
        });
        
    } catch (error) {
        console.error('Test error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

function testClaudeCommand(args) {
    return new Promise((resolve, reject) => {
        console.log('Spawning:', 'claude', args);
        
        const process = spawn('claude', args, {
            stdio: ['ignore', 'pipe', 'pipe']
        });
        
        let output = '';
        let error = '';
        
        process.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        process.stderr.on('data', (data) => {
            error += data.toString();
        });
        
        const timeout = setTimeout(() => {
            process.kill('SIGKILL');
            reject(new Error('Timeout after 600 seconds'));
        }, 600000);
        
        process.on('close', (code) => {
            clearTimeout(timeout);
            resolve({
                code,
                output: output.trim(),
                error: error.trim(),
                success: code === 0
            });
        });
        
        process.on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
        });
    });
}

function testClaudeShell(command) {
    return new Promise((resolve, reject) => {
        console.log('Shell command:', command);
        
        const process = spawn('sh', ['-c', command], {
            stdio: ['ignore', 'pipe', 'pipe']
        });
        
        let output = '';
        let error = '';
        
        process.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        process.stderr.on('data', (data) => {
            error += data.toString();
        });
        
        const timeout = setTimeout(() => {
            process.kill('SIGKILL');
            reject(new Error('Timeout after 600 seconds'));
        }, 600000);
        
        process.on('close', (code) => {
            clearTimeout(timeout);
            resolve({
                code,
                output: output.trim(),
                error: error.trim(),
                success: code === 0
            });
        });
        
        process.on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
        });
    });
}

const PORT = 3333;
app.listen(PORT, () => {
    console.log(`Simple Claude bridge test server running on port ${PORT}`);
    console.log(`Test with: curl -X POST http://localhost:${PORT}/test-claude -H "Content-Type: application/json" -d '{"prompt": "just say hi"}'`);
});