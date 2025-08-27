import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Claude Code Bridge
 * 
 * Creates a bridge from Cofounder to the running Claude Code session
 * Allows Cofounder to:
 * 1. Write generated projects to Claude Code workspace
 * 2. Send development prompts to Claude Code
 * 3. Monitor Claude Code progress
 */
export class ClaudeCodeBridge {
    constructor(config = {}) {
        this.config = {
            workspacePath: config.workspacePath || process.cwd(),
            claudeCommand: config.claudeCommand || 'claude',
            ...config
        };
        
        // Detect if we're running inside Claude Code
        this.isInsideClaudeCode = !!(process.env.CLAUDECODE || process.env.CLAUDE_CODE_ENTRYPOINT);
        
        console.log('[ClaudeCodeBridge] Detected Claude Code environment:', this.isInsideClaudeCode);
    }

    /**
     * Check if Claude Code integration is available
     */
    isAvailable() {
        return this.isInsideClaudeCode;
    }

    /**
     * Write a generated project to the Claude Code workspace
     */
    async deployProject(projectData) {
        if (!this.isInsideClaudeCode) {
            throw new Error('Claude Code bridge not available - not running inside Claude Code');
        }

        const { name, files, structure } = projectData;
        const projectPath = path.join(this.config.workspacePath, name);

        try {
            // Create project directory
            await fs.mkdir(projectPath, { recursive: true });
            
            // Write all files
            const filePromises = files.map(async (file) => {
                const filePath = path.join(projectPath, file.path);
                const fileDir = path.dirname(filePath);
                
                // Ensure directory exists
                await fs.mkdir(fileDir, { recursive: true });
                
                // Write file content
                await fs.writeFile(filePath, file.content, 'utf8');
            });

            await Promise.all(filePromises);

            console.log(`[ClaudeCodeBridge] Project '${name}' deployed to ${projectPath}`);
            
            return {
                success: true,
                projectPath,
                filesWritten: files.length,
                message: `Project deployed to workspace at ${projectPath}`
            };
            
        } catch (error) {
            throw new Error(`Failed to deploy project: ${error.message}`);
        }
    }

    /**
     * Send a development prompt to Claude Code
     * This uses Claude Code CLI to send prompts within the current session
     */
    async sendPrompt(prompt, options = {}) {
        if (!this.isInsideClaudeCode) {
            throw new Error('Claude Code bridge not available - not running inside Claude Code');
        }

        const {
            projectPath,
            continueConversation = false,
            allowedTools = ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
            outputFormat = 'text', // 'text', 'json', or 'stream-json'
            expectStructuredOutput = false
        } = options;

        try {
            // Build command for sending prompt to Claude Code - simplified approach
            const args = ['-p', prompt]; // Use -p flag like the working direct command

            console.log('[ClaudeCodeBridge] Full command will be:', this.config.claudeCommand, args.join(' '));
            console.log('[ClaudeCodeBridge] Sending prompt to Claude Code:', prompt.substring(0, 100) + '...');

            return new Promise((resolve, reject) => {
                console.log('[ClaudeCodeBridge] Args array:', JSON.stringify(args));
                const claudeProcess = spawn(this.config.claudeCommand, args, {
                    stdio: ['ignore', 'pipe', 'pipe'],
                    shell: false,
                    cwd: projectPath || this.config.workspacePath
                });

                let output = '';
                let error = '';

                claudeProcess.stdout.on('data', (data) => {
                    const chunk = data.toString();
                    output += chunk;
                    console.log('[ClaudeCodeBridge] stdout chunk:', chunk);
                });

                claudeProcess.stderr.on('data', (data) => {
                    const chunk = data.toString();
                    error += chunk;
                    console.log('[ClaudeCodeBridge] stderr:', chunk);
                });

                // Proper timeout for MCP server loading - 10 minutes
                const timeout = setTimeout(() => {
                    console.log('[ClaudeCodeBridge] Timeout reached, killing process');
                    claudeProcess.kill('SIGKILL');
                    reject(new Error(`Claude CLI command timed out after 10 minutes`));
                }, 600000);

                claudeProcess.on('close', (code) => {
                    clearTimeout(timeout);
                    console.log('[ClaudeCodeBridge] Process closed with code:', code);
                    console.log('[ClaudeCodeBridge] Output length:', output.length);
                    console.log('[ClaudeCodeBridge] Error length:', error.length);
                    
                    if (code === 0 || output.trim().length > 0) {
                        resolve({
                            success: true,
                            output: output,
                            rawOutput: output,
                            format: 'text',
                            message: 'Prompt sent to Claude Code successfully'
                        });
                    } else {
                        reject(new Error(`Claude Code command failed (code ${code}): ${error}`));
                    }
                });

                claudeProcess.on('error', (err) => {
                    clearTimeout(timeout);
                    console.log('[ClaudeCodeBridge] Process error:', err.message);
                    reject(new Error(`Failed to execute Claude Code command: ${err.message}`));
                });
            });

        } catch (error) {
            throw new Error(`Failed to send prompt to Claude Code: ${error.message}`);
        }
    }

    /**
     * Create a new conversation in Claude Code for a project
     */
    async startProjectConversation(projectData) {
        if (!this.isInsideClaudeCode) {
            throw new Error('Claude Code bridge not available');
        }

        const { name, description, requirements } = projectData;
        
        const introPrompt = `I've generated a new project called "${name}" in the workspace. Here's what was created:

Project Description: ${description}

Key Requirements:
${requirements.map(req => `- ${req}`).join('\n')}

The project files have been written to the workspace. Please review the generated code and help me improve it. What would you like to work on first?`;

        try {
            const result = await this.sendPrompt(introPrompt, {
                projectPath: path.join(this.config.workspacePath, name),
                continueConversation: false,
                allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep']
            });

            return {
                ...result,
                projectPath: path.join(this.config.workspacePath, name),
                conversationStarted: true
            };

        } catch (error) {
            throw new Error(`Failed to start project conversation: ${error.message}`);
        }
    }

    /**
     * Get the current workspace information
     */
    async getWorkspaceInfo() {
        return {
            workspacePath: this.config.workspacePath,
            isInsideClaudeCode: this.isInsideClaudeCode,
            environment: {
                CLAUDECODE: process.env.CLAUDECODE,
                CLAUDE_CODE_ENTRYPOINT: process.env.CLAUDE_CODE_ENTRYPOINT
            }
        };
    }

    /**
     * Generate a PRD (Product Requirements Document) using Claude Code
     */
    async generatePRD(projectData) {
        const { name, description, objectives, targetAudience, features } = projectData;
        
        const prompt = `Generate a comprehensive Product Requirements Document (PRD) for a project called "${name}".

Project Description: ${description}

Objectives:
${objectives.map(obj => `- ${obj}`).join('\n')}

Target Audience: ${targetAudience}

Key Features:
${features.map(feature => `- ${feature}`).join('\n')}

Please create a complete PRD with the following sections:
1. Executive Summary
2. Product Overview  
3. Objectives and Goals
4. Target Audience
5. Feature Requirements
6. Technical Requirements
7. Success Metrics
8. Timeline and Milestones
9. Risk Assessment

Use proper markdown formatting for the document structure.`;

        const result = await this.sendPrompt(prompt, {
            expectStructuredOutput: true,
            allowedTools: ['Write'] // Allow Claude to write the PRD to file
        });

        return {
            ...result,
            documentType: 'PRD',
            projectName: name
        };
    }

    /**
     * Generate an FRD (Functional Requirements Document) using Claude Code  
     */
    async generateFRD(projectData, prdContent = null) {
        const { name, description, features, technicalStack } = projectData;
        
        let prompt = `Generate a comprehensive Functional Requirements Document (FRD) for "${name}".

Project Description: ${description}

Key Features:
${features.map(feature => `- ${feature}`).join('\n')}`;

        if (technicalStack) {
            prompt += `\n\nTechnical Stack: ${technicalStack.join(', ')}`;
        }

        if (prdContent) {
            prompt += `\n\nPlease reference this PRD content:\n${prdContent}`;
        }

        prompt += `\n\nPlease create a detailed FRD with:
1. Functional Requirements (with unique IDs)
2. User Stories and Use Cases
3. System Workflows
4. Data Requirements  
5. Integration Requirements
6. Performance Requirements
7. Security Requirements
8. Acceptance Criteria

Use proper markdown formatting and include requirement traceability.`;

        const result = await this.sendPrompt(prompt, {
            expectStructuredOutput: true,
            allowedTools: ['Write', 'Read'] // Allow Claude to read PRD and write FRD
        });

        return {
            ...result,
            documentType: 'FRD', 
            projectName: name
        };
    }

    /**
     * Generate project code using Claude Code
     */
    async generateProjectCode(projectData) {
        const { name, description, technicalStack, architecture, features } = projectData;
        
        const prompt = `Generate a complete project structure and code for "${name}".

Description: ${description}
Tech Stack: ${technicalStack.join(', ')}
Architecture: ${architecture}

Features to implement:
${features.map(feature => `- ${feature}`).join('\n')}

Please:
1. Create a proper project structure
2. Generate all necessary configuration files  
3. Implement core functionality for each feature
4. Include proper documentation (README, etc.)
5. Follow best practices for the chosen tech stack
6. Include error handling and basic tests

Write all files to the current workspace directory.`;

        const result = await this.sendPrompt(prompt, {
            expectStructuredOutput: false,
            allowedTools: ['Write', 'Edit', 'Bash', 'Read'], // Full file system access
            projectPath: path.join(this.config.workspacePath, name)
        });

        return {
            ...result,
            operationType: 'code-generation',
            projectName: name,
            projectPath: path.join(this.config.workspacePath, name)
        };
    }

    /**
     * Analyze existing project and suggest improvements
     */
    async analyzeProject(projectPath, analysisType = 'general') {
        const analysisPrompts = {
            general: 'Analyze this project structure and code quality. Suggest improvements for architecture, code organization, and best practices.',
            security: 'Perform a security analysis of this project. Identify potential vulnerabilities and suggest security improvements.',
            performance: 'Analyze this project for performance issues. Suggest optimizations for speed, memory usage, and scalability.',
            architecture: 'Review the project architecture. Suggest improvements for maintainability, scalability, and design patterns.'
        };

        const prompt = `${analysisPrompts[analysisType]}

Please examine all files in the project and provide:
1. Current state assessment
2. Specific issues identified
3. Prioritized recommendations  
4. Implementation suggestions
5. Potential risks of changes

Focus on actionable insights that can improve the project.`;

        const result = await this.sendPrompt(prompt, {
            projectPath,
            allowedTools: ['Read', 'Glob', 'Grep'], // Read-only analysis
            expectStructuredOutput: true
        });

        return {
            ...result,
            analysisType,
            projectPath
        };
    }
}

export default ClaudeCodeBridge;