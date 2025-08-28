# Claude Code Bridge Architecture

## Core Concept
Cofounder = Project Structure Engine
Claude Code = AI/LLM Engine  
Bridge = Communication layer between them

## Role Separation

### Cofounder's Role:
- Project workflow management
- Real-time dashboard and visualization
- File structure and organization  
- Template management
- Status tracking and progress monitoring
- Integration coordination

### Claude Code's Role (via Bridge):
- All AI/LLM operations 
- Document generation (PRD, FRD, etc.)
- Code generation and analysis
- Architecture planning
- AI-powered project enhancement

## Bridge Implementation

### Key Files:
- `cofounder/api/utils/claude-code-bridge.js` - Main bridge interface
- Bridge endpoints in `server.js` for API access
- Environment detection via `CLAUDECODE=1` and `CLAUDE_CODE_ENTRYPOINT=cli`

### Bridge Methods:
- `generatePRD()` - Product Requirements Document
- `generateFRD()` - Functional Requirements Document  
- `generateProjectCode()` - Complete code generation
- `analyzeProject()` - Project analysis
- `sendPrompt()` - Generic Claude Code communication

### Authentication:
- Inside Claude Code: Use API keys for non-Claude operations only
- Claude Code handles its own authentication 
- Bridge leverages authenticated Claude Code session

## Workflow:
1. Cofounder structures request
2. Bridge sends formatted prompt to Claude Code
3. Claude Code processes with AI capabilities
4. Bridge receives structured output
5. Cofounder organizes and displays results