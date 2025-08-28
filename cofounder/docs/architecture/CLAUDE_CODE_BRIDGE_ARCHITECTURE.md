# Claude Code Bridge Architecture

## 🎯 **Core Philosophy**

**Cofounder** = Project Structure & Workflow Engine  
**Claude Code** = AI/LLM Processing Engine  
**Bridge** = Seamless Integration Layer

## 🏗️ **Architecture Overview**

```
┌─────────────────────────────────────────────────────┐
│                  COFOUNDER                          │
│            (Project Structure Engine)               │  
│                                                     │
│  Dashboard  │  Workflow   │  Templates  │   Files   │
│  - Real-time│  - Project  │  - Boiler   │  - Org    │
│  - Visual   │  - Tracking │  - Patterns │  - Structure│
│  - Status   │  - Mgmt     │  - Scaffold │  - Deploy │
└─────────────────────┼───────────────────────────────┘
                      │ 🌉 CLAUDE CODE BRIDGE
                      ▼
┌─────────────────────────────────────────────────────┐
│                  CLAUDE CODE                        │  
│                 (AI/LLM Engine)                     │
│                                                     │
│  LLM Ops    │  Documents  │  Code Gen   │  Analysis │
│  - Prompts  │  - PRD      │  - Full     │  - Arch   │
│  - Planning │  - FRD      │  - Files    │  - Review │
│  - Strategy │  - Specs    │  - Structure│  - Improve│
└─────────────────────────────────────────────────────┘
```

## 🔄 **Integration Flow**

### **1. Request Initiation**
```javascript
// User action in Cofounder dashboard
→ Generate PRD for "E-commerce Platform"
```

### **2. Bridge Processing**  
```javascript
// Cofounder structures the request
const request = {
    operation: 'generatePRD',
    projectName: 'E-commerce Platform',
    features: ['user auth', 'shopping cart', 'payments'],
    objectives: ['scalability', 'security', 'performance']
};

// Bridge formats for Claude Code
const prompt = `Generate a comprehensive PRD for "E-commerce Platform"...
[Structured prompt with all context]`;
```

### **3. Claude Code Execution**
```bash
# Bridge sends to Claude Code via CLI
claude --print --output-format json --allowed-tools Write \
  "Generate comprehensive PRD for E-commerce Platform..."
```

### **4. Result Processing**
```javascript
// Claude Code returns structured result
const result = {
    success: true,
    output: "# Product Requirements Document\n## Executive Summary...",
    documentType: 'PRD'
};

// Cofounder organizes and displays
→ Dashboard updates with generated PRD
→ Files written to project structure
→ Workflow advances to next stage
```

## 🛠️ **Technical Implementation**

### **Bridge Detection**
```javascript
// Automatic environment detection
const isInsideClaudeCode = !!(
    process.env.CLAUDECODE || 
    process.env.CLAUDE_CODE_ENTRYPOINT
);

// Bridge automatically enables when inside Claude Code
if (isInsideClaudeCode) {
    console.log('🌉 Claude Code Bridge: ACTIVE');
    // All AI operations → Claude Code
    // Cofounder handles structure only
}
```

### **Key Bridge Methods**

#### **Document Generation**
```javascript
await bridge.generatePRD(projectData);     // Product Requirements
await bridge.generateFRD(projectData);     // Functional Requirements  
await bridge.generateDRD(projectData);     // Design Requirements
await bridge.generateArchDocs(projectData); // Architecture Documentation
```

#### **Code Operations**
```javascript
await bridge.generateProjectCode(projectData); // Complete project generation
await bridge.analyzeProject(projectPath);      // Code analysis & suggestions
await bridge.optimizeCode(projectPath);        // Performance optimization
await bridge.securityReview(projectPath);      // Security analysis
```

#### **General AI Operations**  
```javascript
await bridge.sendPrompt(prompt, options);      // Any custom prompt
await bridge.planProject(requirements);        // Project planning
await bridge.designArchitecture(specs);        // System design
```

### **API Endpoints**
```javascript
// Bridge status and control
GET    /api/claude-code/status           // Check bridge availability
POST   /api/claude-code/send-prompt      // Send any prompt to Claude Code

// Document generation
POST   /api/claude-code/generate-prd     // Generate PRD
POST   /api/claude-code/generate-frd     // Generate FRD
POST   /api/claude-code/generate-docs    // Generate any documentation

// Project operations  
POST   /api/claude-code/deploy-project   // Deploy generated project to workspace
POST   /api/claude-code/analyze-project  // Analyze existing project
POST   /api/claude-code/start-conversation // Start project development conversation
```

## 🔐 **Authentication Strategy**

### **Inside Claude Code Environment**
```javascript
// Detected: CLAUDECODE=1, CLAUDE_CODE_ENTRYPOINT=cli
→ Skip Claude Code authentication (already authenticated)
→ Use API keys only for non-Claude operations (if any)  
→ Bridge leverages existing Claude Code session
→ All AI work delegates to authenticated Claude Code
```

### **Authentication Priority**
```javascript
// When inside Claude Code:
const providerPriority = [
    'api-key'  // Only for non-Claude operations
    // Skip: 'claude-code-cli', 'claude-session' (redundant)
];

// Claude Code handles all AI authentication internally
```

## 📊 **Operational Examples**

### **PRD Generation Workflow**
```
1. User: "Generate PRD for mobile banking app"
2. Cofounder: Structures request with project template
3. Bridge: Sends formatted prompt to Claude Code
   "Generate comprehensive PRD for mobile banking app with 
    security requirements, user stories, technical specs..."
4. Claude Code: Processes with full AI capabilities, generates PRD
5. Bridge: Receives structured markdown document  
6. Cofounder: Organizes PRD into project docs, updates dashboard
7. Result: Complete PRD ready for development team
```

### **Full Project Generation Workflow**
```
1. User: "Create React e-commerce site with authentication"
2. Cofounder: Defines project structure and requirements
3. Bridge: Delegates to Claude Code for implementation
   "Create complete React e-commerce project with auth, 
    shopping cart, payment integration, proper structure..."
4. Claude Code: Generates full project with all files
5. Bridge: Captures generated files and structure
6. Cofounder: Deploys to workspace, updates project tracking
7. Result: Complete, working e-commerce application
```

## 🎯 **Benefits**

### **Separation of Concerns**
- **Cofounder**: Focuses on project management excellence
- **Claude Code**: Focuses on AI/coding excellence  
- **Bridge**: Clean, simple integration layer

### **Leveraged Authentication**
- No duplicate authentication systems
- Uses existing Claude Code subscription
- No API key management complexity

### **Real-time Integration**
- Live progress updates
- Seamless workflow between tools
- Single development environment

### **Scalable Architecture**  
- Easy to extend bridge capabilities
- Clear integration points
- Maintainable codebase

## 🚀 **Usage**

### **Development Workflow**
```bash
# 1. Start from Claude Code (already authenticated)
claude

# 2. Launch Cofounder (bridge auto-detects environment)
cd cofounder/api
npm run start

# 3. Access dashboard (bridge integration active)
http://localhost:4200

# 4. Generate projects using Claude Code's AI via bridge
→ All AI operations seamlessly delegate to Claude Code
→ All structure/workflow handled by Cofounder  
→ Real-time integration and progress tracking
```

### **Bridge Status Check**
```bash
curl http://localhost:4200/api/claude-code/status
# Returns: { available: true, environment: {...} }
```

## 📝 **Key Files**

```
cofounder/api/utils/claude-code-bridge.js     # Main bridge implementation
cofounder/api/server.js                       # Bridge API endpoints  
cofounder/api/utils/auth/manager.js           # Updated auth strategy
PROJECT_DOCUMENTATION.md                      # Updated architecture docs
CLAUDE_CODE_BRIDGE_ARCHITECTURE.md           # This comprehensive guide
```

---

**This architecture ensures Cofounder and Claude Code work together seamlessly, with each tool doing what it does best, connected by a clean, efficient bridge.**