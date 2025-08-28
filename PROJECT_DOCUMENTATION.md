# Cofounder Project Documentation

## 📋 Executive Summary

Cofounder is an AI-powered full-stack web application generator that creates complete applications including backend services, databases, and responsive frontends. The platform recently integrated Claude Code CLI authentication, enabling subscription-based usage instead of per-token billing.

**Status**: Early Alpha (Pre-v1.0) - Unstable/Experimental  
**Latest Update**: Claude Code Integration (commits 07146ba, 6e83d53)

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
├── apps/cofounder-recursive/     # Example recursive application
├── cofounder/
│   ├── api/                     # Backend server
│   │   ├── src/                 # Source code
│   │   ├── system/              # System functions
│   │   ├── utils/               # Utilities
│   │   │   └── auth/            # Authentication
│   │   ├── dist/                # Built frontend
│   │   └── server.js            # Main entry
│   ├── dashboard/               # React frontend
│   │   └── src/
│   │       ├── components/      # UI components
│   │       └── App.tsx          # Main app
│   ├── boilerplate/             # Templates
│   ├── visualizer/              # Visualization
│   └── docs/                    # Documentation
└── benchmarks/                  # Performance tests
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

### Configuration

Create `.env` file in `cofounder/api`:

```env
# Authentication Provider (api-key or claude-session)
AUTH_PROVIDER=claude-session

# Claude Code Configuration
CLAUDE_CODE_PORT=3000

# API Keys (if using api-key provider)
ANTHROPIC_API_KEY=your-key-here
OPENAI_API_KEY=your-key-here
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

## 🔌 API Endpoints

### Authentication Management
- `GET /api/auth/status` - Current auth status
- `GET /api/auth/providers` - Available providers
- `POST /api/auth/switch` - Switch provider
- `POST /api/auth/refresh` - Refresh providers

### Claude Code Integration
- `GET /api/claude-code/status` - Claude Code status
- `POST /api/claude-code/launch` - Launch Claude Code
- `POST /api/claude-code/authenticate` - Authenticate session

### Project Management
- `POST /api/project/create` - Create new project
- `GET /api/project/:id` - Get project details
- `POST /api/project/generate` - Generate code

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