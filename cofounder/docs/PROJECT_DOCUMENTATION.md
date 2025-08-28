# Cofounder Project Documentation

## 📋 Executive Summary

Cofounder is an AI-powered full-stack web application generator that creates complete applications including backend services, databases, and responsive frontends. The platform features comprehensive Claude Code CLI integration, advanced AST analysis capabilities, and a real-time flow-based visualization system for project generation and management.

**Status**: Active Development (Pre-v1.0) - Feature Complete Alpha  
**Latest Update**: Comprehensive cleanup and documentation update (commit 225c09f)  
**Previous Milestone**: Claude Code Integration (commits 32d23e8, 07146ba, 6e83d53)

## 🏗️ Architecture Overview

### **Core Concept: Complementary Tool Architecture**

Cofounder operates as a **Project Structure & Workflow Engine** that delegates all AI/LLM operations to Claude Code via a bridge interface.

```
┌─────────────────────────────────────────────────────┐
│                  COFOUNDER                          │
│            (Project Structure Engine)               │  
│                                                     │
│  ┌─────────────────┬─────────────────────────────┐  │
│  │   Dashboard     │    Workflow Engine          │  │
│  │   - Real-time   │    - Project management     │  │  
│  │   - Visualization│   - File organization      │  │
│  │   - Status      │    - Template system        │  │
│  └─────────────────┴─────────────────────────────┘  │
│                         │                           │
└─────────────────────────┼───────────────────────────┘
                          │ BRIDGE
                          ▼
┌─────────────────────────────────────────────────────┐
│                  CLAUDE CODE                        │  
│                 (AI/LLM Engine)                     │
│                                                     │
│  ┌─────────────────┬─────────────────────────────┐  │
│  │   LLM Operations│    Document Generation      │  │
│  │   - Code gen    │    - PRD creation          │  │
│  │   - Analysis    │    - FRD development       │  │  
│  │   - Planning    │    - Architecture docs     │  │
│  └─────────────────┴─────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### **Role Separation**

#### **Cofounder's Responsibilities:**
- Project workflow management and coordination
- Real-time dashboard and visualization  
- File structure and organization
- Template management and project scaffolding
- Status tracking and progress monitoring
- Integration with external services

#### **Claude Code's Responsibilities (via Bridge):**  
- All AI/LLM operations (PRD, FRD, code generation)
- Document generation and content creation
- Code analysis and improvement suggestions
- Architecture planning and technical decisions
- AI-powered project enhancement
```

### Bridge Architecture Components

#### **1. Claude Code Bridge** (`cofounder/api/utils/claude-code-bridge.js`)
- **Purpose**: Interface between Cofounder and Claude Code
- **Detection**: Automatically detects Claude Code environment (`CLAUDECODE=1`)
- **Operations**: Delegates all AI work to Claude Code via CLI interface
- **Methods**: 
  - `generatePRD()` - Product Requirements Document generation
  - `generateFRD()` - Functional Requirements Document creation  
  - `generateProjectCode()` - Complete project code generation
  - `analyzeProject()` - Project analysis and improvement suggestions
  - `deployProject()` - Write generated files to workspace
  - `sendPrompt()` - Send any prompt to Claude Code

#### **2. Cofounder API Server** (`cofounder/api`)
- **Purpose**: Project workflow coordination and bridge orchestration
- **Role**: Structure engine that organizes Claude Code's AI output
- **Bridge Endpoints**:
  - `GET /api/claude-code/status` - Check bridge availability
  - `POST /api/claude-code/deploy-project` - Deploy generated projects
  - `POST /api/claude-code/send-prompt` - Send prompts to Claude Code
  - `POST /api/claude-code/start-conversation` - Initiate project workflows

#### **3. Dashboard Interface** (`cofounder/dashboard`)
- **Purpose**: Real-time visualization and project management
- **Integration**: Communicates with bridge via API endpoints
- **Features**: Project status, workflow tracking, Claude Code integration status

## 🚀 Recent Changes & Integration

### Claude Code Integration (Latest)

The most significant recent change is the complete integration with Claude Code CLI, allowing:

1. **Subscription-Based Usage**: Use Claude subscription instead of API tokens
2. **Unified Development**: Single command launches both services
3. **Real-time Visualization**: Live feedback through Cofounder dashboard
4. **Flexible Authentication**: Switch between providers on-demand

### Key Files Added/Modified

```
New Files:
- claude-code-launcher.js         # Unified launcher script
- utils/claude-code-integration.js # Integration logic
- utils/auth/providers/claude-code-cli.js # CLI provider
- components/views/auth-settings.tsx # Enhanced auth UI

Modified:
- server.js                        # Added Claude Code endpoints
- utils/auth/manager.js           # Enhanced provider management
- App.tsx                         # Added auth routes
```

### **Bridge Integration Flow**

```javascript
// Cofounder Workflow Example
1. User requests PRD generation via dashboard
2. Cofounder structures the request with project data
3. Bridge sends formatted prompt to Claude Code:
   "Generate PRD for project X with features Y..."
4. Claude Code processes with full AI capabilities
5. Bridge receives structured output from Claude Code  
6. Cofounder organizes output into project structure
7. Dashboard shows real-time progress and results

// Technical Implementation
const bridge = new ClaudeCodeBridge();
const prdResult = await bridge.generatePRD({
    name: "MyProject",
    features: ["auth", "dashboard", "api"],
    objectives: ["scalability", "security"]
});
// Result: Structured PRD generated by Claude Code
```

### **Environment Detection**

```bash
# When running inside Claude Code:
CLAUDECODE=1
CLAUDE_CODE_ENTRYPOINT=cli

# Bridge automatically detects and enables integration
# Cofounder uses API keys only for non-Claude operations
# All AI/LLM work delegates to Claude Code
```javascript
// Provider Selection Logic
1. Check AUTH_PROVIDER environment variable
2. Initialize requested provider
3. Fall back to available provider if needed
4. Maintain session state across requests
```

## 📦 Project Structure

```
cofounder/
├── .serena/                     # Serena MCP session management
│   ├── cache/                   # TypeScript symbol caches
│   ├── memories/                # Project knowledge base
│   └── project.yml              # Project configuration
├── cofounder/
│   ├── api/                     # Node.js Express API Server
│   │   ├── system/              # Core generation functions
│   │   │   ├── functions/       # Modular generation functions
│   │   │   │   ├── op/          # Operations (AST, cache, analysis)
│   │   │   │   ├── pm/          # Product management docs
│   │   │   │   ├── backend/     # Server generation
│   │   │   │   ├── frontend/    # UI generation
│   │   │   │   └── db/          # Database schemas
│   │   │   └── presets/         # UI design systems
│   │   │       └── ui/design/systems/
│   │   │           ├── shadcn/  # Shadcn UI components
│   │   │           └── protoboy-v1/ # Custom design system
│   │   ├── utils/               # Utilities & integrations
│   │   │   ├── auth/            # Multi-provider authentication
│   │   │   │   └── providers/   # OpenAI, Anthropic, Claude CLI
│   │   │   ├── claude-code-integration.js # Claude Code bridge
│   │   │   └── anthropic.js     # AI service clients
│   │   └── server.js            # Main Express server
│   ├── dashboard/               # React TypeScript Frontend
│   │   └── src/
│   │       ├── components/      # React components
│   │       │   ├── flow/        # React Flow visualization
│   │       │   │   ├── nodes/   # Custom flow nodes
│   │       │   │   ├── controls/ # Flow controls
│   │       │   │   └── utils/   # Layout algorithms
│   │       │   ├── views/       # Page components
│   │       │   └── ui/          # Shadcn UI components
│   │       ├── store/           # Redux Toolkit state
│   │       └── hooks/           # React hooks
│   ├── boilerplate/             # Project templates
│   │   ├── backend-boilerplate/ # Express + PGLite template
│   │   └── vitereact-boilerplate/ # Vite + React template
│   ├── docs/                    # Structured documentation
│   │   ├── product-strategy/    # PRD, BRD documents
│   │   ├── requirements/        # FRD, DRD documents
│   │   └── ux-design/           # UX specifications
│   └── visualizer/              # Python visualization tool
├── apps/                        # Generated applications
├── benchmarks/                  # Performance testing
├── AST_BLUEPRINT_DESIGN.md      # AST analysis documentation
├── CLAUDE_CODE_BRIDGE_ARCHITECTURE.md # Integration docs
└── PROJECT_DOCUMENTATION.md    # This file
```

## 🛠️ Development Setup

### Prerequisites
- Node.js (v18+)
- npm or yarn
- Claude Code CLI (optional, for session auth)

### Installation

```bash
# Clone repository
git clone <repository-url>
cd cofounder

# Install API dependencies
cd cofounder/api
npm install

# Install dashboard dependencies
cd ../dashboard
npm install
```

### Technology Stack

#### **Backend (cofounder/api)**
- **Runtime**: Node.js with ES modules
- **Framework**: Express.js with Socket.IO for real-time updates
- **Authentication**: Multi-provider system (OpenAI, Anthropic, Claude CLI)
- **AI Integration**: @anthropic-ai/sdk, openai, claude-code-bridge
- **Code Analysis**: @babel/parser, @babel/traverse for AST parsing
- **Database**: PGLite (embedded PostgreSQL)
- **Storage**: Firebase Admin SDK, Google Cloud Storage
- **Build**: Vite for frontend serving

#### **Frontend (cofounder/dashboard)**
- **Framework**: React 18 with TypeScript
- **State Management**: Redux Toolkit with persistence
- **UI Components**: Radix UI primitives + Shadcn UI system
- **Visualization**: @xyflow/react for project flow diagrams
- **Styling**: Tailwind CSS with animations
- **Form Handling**: React Hook Form with Zod validation
- **Real-time**: Socket.IO client for live updates
- **Speech**: react-speech-recognition for voice input

#### **Development Tools**
- **Build System**: Vite with TypeScript support
- **Linting**: ESLint with React and TypeScript rules
- **Package Management**: npm with workspace support
- **Session Management**: Serena MCP for project persistence

### Configuration

Create `.env` file in `cofounder/api`:

```env
# Authentication Provider Selection
AUTH_PROVIDER=claude-session  # or api-key, claude-code-cli

# Claude Code Integration
CLAUDE_CODE_PORT=3000
CLAUDECODE=1  # Auto-detected in Claude Code environment

# AI Provider API Keys (if using api-key provider)
ANTHROPIC_API_KEY=your-anthropic-key-here
OPENAI_API_KEY=your-openai-key-here

# Firebase Configuration (optional)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-service-email

# Server Configuration
PORT=4200
NODE_ENV=development
```

### Running the Application

#### Option 1: Unified Launch (Recommended)
```bash
cd cofounder/api
npm run start:with-claude
```

#### Option 2: Separate Services
```bash
# Terminal 1 - API Server
cd cofounder/api
npm run start

# Terminal 2 - Dashboard
cd cofounder/dashboard
npm run dev
```

#### Option 3: API Keys Only
```bash
export AUTH_PROVIDER=api-key
cd cofounder/api
npm run start
```

## 🎯 Current Feature Set

### **Core Capabilities**
- **Full-Stack Generation**: Complete applications with frontend, backend, and database
- **Real-time Visualization**: React Flow-based project structure visualization
- **Multi-Provider Authentication**: OpenAI, Anthropic, and Claude Code CLI support
- **AST Analysis**: Advanced Abstract Syntax Tree parsing and project understanding
- **Project Caching**: Intelligent caching system for project state and analysis
- **Session Management**: Persistent session state via Serena MCP integration

### **Generation Features**
- **Product Management**: PRD, BRD, FRD, DRD document generation
- **UX Design**: Sitemap and user experience specification creation
- **Database Design**: PostgreSQL schema generation with relationships
- **API Generation**: OpenAPI and AsyncAPI specification creation
- **Frontend Components**: React/TypeScript component generation with Shadcn UI
- **Backend Services**: Express.js server generation with authentication

### **Advanced Features**
- **Voice Input**: Speech-to-text for project descriptions
- **Project Import**: Analyze and import existing codebases
- **Flow Controls**: Dynamic layout algorithms and depth visualization
- **Design Systems**: Multiple UI design system support (Shadcn, Protoboy)
- **Real-time Updates**: WebSocket-based live progress tracking

## 🔌 API Endpoints

### Core System
- `GET /api/ping` - Health check endpoint
- `GET /api/projects/list` - List all projects
- `POST /api/projects/new` - Create new project
- `POST /api/project/resume` - Resume project generation
- `POST /api/project/analyze` - Analyze existing project
- `POST /api/project/actions` - Execute project actions

### Authentication Management
- `GET /api/auth/info` - Current authentication info
- `GET /api/auth/health` - Authentication system health
- `GET /api/auth/providers` - Available providers
- `POST /api/auth/switch` - Switch authentication provider
- `POST /api/auth/refresh` - Refresh authentication
- `POST /api/auth/switch-provider` - Switch to different provider

### Claude Code Integration
- `GET /api/claude-code/status` - Claude Code integration status
- `POST /api/claude-code/generate-prd` - Generate PRD via Claude Code
- `POST /api/claude-code/send-prompt` - Send custom prompt
- `POST /api/claude-code/deploy-project` - Deploy generated project

### Utilities
- `POST /api/utils/transcribe` - Speech-to-text transcription

## 🧪 Testing

### Authentication System Test
```bash
cd cofounder/api
node test-auth.js
```

This verifies:
- Provider initialization
- Fallback mechanisms
- API endpoints
- Session management

## 📊 Performance Considerations

### Token Usage
- Early alpha consumes significant tokens
- Use Claude session for subscription-based billing
- Monitor usage through dashboard

### Optimization Tips
- Use feature branches for experimentation
- Enable caching where possible
- Batch operations for efficiency

## 🔒 Security

### Best Practices
- Never commit API keys to repository
- Use environment variables for secrets
- Rotate keys regularly
- Monitor authentication logs

### Provider Security
- API Key: Direct provider access
- Claude Session: Proxied through Claude Code
- All providers validate before operations

## 🚧 Known Limitations (Alpha)

1. **Stability**: Frequent breaking changes expected
2. **Token Usage**: High consumption in current version
3. **Feature Gaps**: Project iteration modules not yet merged
4. **Documentation**: Some areas still being documented

## 🗺️ Roadmap

### Immediate Priorities
- [ ] Stabilize core functionality
- [ ] Reduce token consumption
- [ ] Complete project iteration modules
- [ ] Enhance error recovery

### Future Enhancements
- [ ] Additional authentication providers
- [ ] Advanced project templates
- [ ] Collaborative features
- [ ] Performance optimizations

## 📚 Additional Resources

- [Integration Guide](./INTEGRATION_COMPLETE.md)
- [Product Requirements](./cofounder/docs/requirements/)
- [UX Documentation](./cofounder/docs/ux-design/)
- [Contributing Guide](./CONTRIBUTING.md)

## 🤝 Support & Feedback

- GitHub Issues: Report bugs and request features
- Documentation: Check docs folder for detailed guides
- Community: Join discussions in repository

## ⚠️ Important Notes

This is an **EARLY ALPHA RELEASE**:
- Expect frequent changes and potential breaks
- Not recommended for production use
- High token consumption warning
- Wait for v1.0 for stability

---

*Last Updated: Based on commit 07146ba (Latest Claude Code integration)*