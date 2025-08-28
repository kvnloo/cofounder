# Cofounder API Architecture

## Overview

The Cofounder API is a Node.js Express server that orchestrates AI-powered full-stack application generation. It serves as the central coordination point between the frontend dashboard, AI providers, and the generation workflow system.

## Architecture Components

### 1. Core Server (`server.js`)
- **Express.js** application with CORS and Socket.IO
- **Port**: 4200 (configurable via environment)
- **Real-time updates** via WebSocket connections
- **Multi-provider authentication** system

### 2. System Functions (`system/functions/`)

#### Product Management (`pm/`)
- `prd.js` - Product Requirements Document generation
- `frd.js` - Functional Requirements Document creation
- `brd.js` - Business Requirements Document development
- `drd.js` - Data Requirements Document specification
- `uxsmd.js` - UX Specification and Mockup Document
- `uxdmd.js` - UX Design and Mockup Document

#### Database Layer (`db/`)
- `schemas.js` - Database schema generation
- `postgres.js` - PostgreSQL implementation generation

#### Backend Generation (`backend/`)
- `server.js` - Express.js server code generation
- `openapi.js` - REST API specification creation
- `asyncapi.js` - WebSocket API specification creation

#### Frontend Generation (`webapp/`)
- `root.js` - Root component generation
- `store.js` - Redux store setup generation
- `view.js` - React component generation

#### Operations (`op/`)
- `analyze.js` - Project analysis and import
- `ast-analyzer.js` - Abstract Syntax Tree parsing
- `project-cache.js` - Project state caching
- `project.js` - Project management operations
- `render.js` - Template rendering
- `convert.js` - Format conversion utilities

#### Quality Assurance (`swarm/`)
- `review.js` - Code review and validation
- `augment.js` - Code enhancement and optimization  
- `fix.js` - Bug detection and resolution

#### UX Structure (`ux/`)
- `sitemap.js` - Site structure generation
- `datamap.js` - Data flow mapping

### 3. Utilities (`utils/`)

#### Authentication (`auth/`)
- `manager.js` - Authentication manager
- `providers/` - Authentication provider implementations
  - `api-key.js` - API key authentication
  - `claude-code-cli.js` - Claude Code CLI integration
  - `claude-session.js` - Claude session management

#### AI Integration
- `anthropic.js` - Anthropic Claude API client
- `openai.js` - OpenAI API client
- `claude-code-integration.js` - Claude Code bridge
- `llm.js` - LLM abstraction layer

#### Storage & Data
- `firebase.js` - Firebase integration
- `storage.js` - File storage management
- `vectra.js` - Vector database operations
- `parsers.js` - Content parsing utilities

## API Endpoints

### Core System
```
GET  /api/ping                 - Health check
GET  /api/projects/list        - List all projects
POST /api/projects/new         - Create new project
POST /api/project/resume       - Resume project generation
POST /api/project/analyze      - Analyze existing project
POST /api/project/actions      - Execute project actions
```

### Authentication
```
GET  /api/auth/info            - Authentication status
GET  /api/auth/health          - Auth system health
GET  /api/auth/providers       - Available providers
POST /api/auth/switch          - Switch auth provider
POST /api/auth/refresh         - Refresh authentication
POST /api/auth/switch-provider - Change provider
```

### Claude Code Integration
```
GET  /api/claude-code/status       - Integration status
POST /api/claude-code/generate-prd - Generate PRD via Claude
POST /api/claude-code/send-prompt  - Send custom prompt
POST /api/claude-code/deploy-project - Deploy generated project
```

### Utilities
```
POST /api/utils/transcribe     - Speech-to-text transcription
```

## Workflow Engine

### Sequence Processing
The API uses a sequence-based workflow engine defined in `build.js`:

1. **Node Registration**: All function modules are dynamically loaded
2. **Sequence Definition**: YAML files define execution order
3. **Dependency Resolution**: Automatic dependency graph execution
4. **Event System**: Real-time progress tracking via EventEmitter
5. **Queue Management**: Concurrent execution with priority queues

### Example Workflow (`seq:project:init:v1`)
```
Project Setup → PM Documents → Database → Backend → UX → Frontend → Quality
```

## Technology Stack

### Core Dependencies
- **express** - Web server framework
- **socket.io** - Real-time communication
- **@anthropic-ai/sdk** - Claude API client
- **openai** - OpenAI API client
- **@babel/parser** - JavaScript AST parsing
- **firebase-admin** - Firebase integration
- **sharp** - Image processing
- **yaml** - YAML processing

### Development Tools  
- **nodemon** - Development auto-restart
- **esm-module-alias** - Module path aliasing
- **dotenv** - Environment variable management

## Configuration

### Environment Variables
```env
# Authentication
AUTH_PROVIDER=claude-session
ANTHROPIC_API_KEY=your-key
OPENAI_API_KEY=your-key

# Claude Code Integration  
CLAUDE_CODE_PORT=3000
CLAUDECODE=1

# Firebase (optional)
FIREBASE_PROJECT_ID=your-project
FIREBASE_PRIVATE_KEY=your-key
FIREBASE_CLIENT_EMAIL=your-email

# Server
PORT=4200
NODE_ENV=development
```

### Module Aliases
- `@/` maps to API root directory
- Enables clean imports like `@/utils/auth/manager.js`

## Development Patterns

### Function Structure
Each system function follows this pattern:
```javascript
export default async function(task) {
  const { context, data } = task;
  
  // Function implementation
  
  return {
    success: true,
    result: output,
    context: updatedContext
  };
}
```

### Error Handling
- Comprehensive try-catch blocks
- Structured error responses
- Real-time error broadcasting via Socket.IO

### Real-time Updates
- Socket.IO rooms per project
- Progress tracking events
- Live status updates to dashboard

## Security Considerations

### Authentication
- Multi-provider support with fallbacks
- API key encryption and secure storage
- Session-based authentication for Claude Code

### Input Validation
- Request body validation
- File path sanitization
- SQL injection prevention

### Rate Limiting
- Authentication provider rate limits
- API endpoint protection
- Resource usage monitoring

## Performance Optimizations

### Caching
- Project state caching via `project-cache.js`
- AST analysis result caching
- Template rendering caching

### Concurrency
- Queue-based function execution
- Parallel processing where possible
- Resource pool management

### Memory Management
- Streaming for large file operations
- Garbage collection optimization
- Memory usage monitoring

---

*This documentation reflects the current API architecture as of the latest comprehensive analysis and cleanup.*