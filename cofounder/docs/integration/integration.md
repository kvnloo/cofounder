# Cofounder + Claude Code Integration

## Overview
This document outlines the integration of the Cofounder project with Claude Code to enable subscription-based authentication instead of per-token API key usage.

## Goals
1. **Unified Authentication**: Use Claude Code's session-based authentication within Cofounder
2. **Real-time Integration**: Launch Cofounder dashboard alongside Claude Code for live change visualization
3. **Subscription-based Usage**: Leverage Claude subscription instead of pay-per-token API usage
4. **Non-invasive Design**: Add new auth methods without breaking existing API key functionality

## Current Architecture

### Cofounder Structure
```
/cofounder/
├── api/                    # Node.js/Express server (port 4200)
│   ├── server.js          # Main server with Socket.io
│   ├── utils/
│   │   ├── openai.js      # OpenAI API integration
│   │   ├── anthropic.js   # Anthropic API integration
│   │   └── index.js       # Utils aggregator
│   ├── system/
│   │   └── functions/
│   │       └── op/
│   │           └── llm.js # LLM operation handler
│   └── .env               # API keys configuration
├── dashboard/             # React/Vite frontend (port 5200)
└── apps/                  # Generated applications output
```

### Current Authentication Flow
1. API keys stored in `/cofounder/api/.env`
2. Direct SDK calls to OpenAI/Anthropic APIs
3. LLM provider selection via `LLM_PROVIDER` env var
4. Authentication handled in `utils/openai.js` and `utils/anthropic.js`

## Integration Architecture

### 1. Authentication Provider System
Create a pluggable authentication system supporting:
- **API Key Provider** (existing): Direct API key usage
- **Claude Session Provider** (new): Claude Code session tokens  
- **OpenAI Session Provider** (new): OAuth-based OpenAI account auth

### 2. Proxy Layer Architecture
```
Cofounder Dashboard -> Cofounder API -> Auth Provider -> LLM Service
                                     ├─ API Key Provider -> Direct API
                                     ├─ Claude Session -> Claude Code Proxy
                                     └─ OpenAI Session -> OpenAI OAuth Proxy
```

### 3. Implementation Components

#### Auth Provider Interface (`/utils/auth/providers/base.js`)
```javascript
class AuthProvider {
  async initialize(config) { /* Setup auth */ }
  async authenticate() { /* Perform auth */ }
  async makeRequest(options) { /* Make authenticated request */ }
  async isValid() { /* Check auth validity */ }
}
```

#### Claude Session Provider (`/utils/auth/providers/claude-session.js`)
- Integrates with Claude Code's session management
- Proxies requests through Claude Code's authenticated endpoints
- Handles session refresh and validation

#### Auth Manager (`/utils/auth/manager.js`)
- Manages provider selection and initialization
- Provides unified interface for LLM operations
- Handles fallback between providers

### 4. Integration Points

#### LLM Operations (`/system/functions/op/llm.js`)
- Modified to use Auth Manager instead of direct SDK calls
- Provider selection based on configuration
- Maintains existing interface for backward compatibility

#### Server Initialization (`/server.js`)
- Initialize Auth Manager on startup
- Expose auth status via Socket.io for dashboard
- Add auth-related API endpoints

#### Dashboard Integration
- Add authentication UI for provider selection
- Display current auth status and token usage
- Provider-specific configuration interfaces

## Implementation Plan

### Phase 1: Authentication Infrastructure
1. ✅ Create auth provider base interface
2. ✅ Implement Claude session provider
3. ✅ Create auth manager
4. ✅ Add auth configuration to environment

### Phase 2: Core Integration  
5. ✅ Modify LLM utilities to use auth providers
6. ✅ Update server initialization
7. ✅ Add proxy server for authenticated requests
8. ✅ Test basic authentication flow

### Phase 3: Dashboard & UX
9. ✅ Add authentication UI to dashboard
10. ✅ Implement provider switching
11. ✅ Add auth status indicators
12. ✅ Create unified launcher script

### Phase 4: Package Integration
13. ✅ Update package.json for Claude Code integration
14. ✅ Create launch scripts
15. ✅ Test full integration
16. ✅ Documentation and examples

## Configuration

### Environment Variables
```bash
# Authentication Provider Selection
AUTH_PROVIDER="claude-session" # "api-key", "claude-session", "openai-session"

# Existing API Key Configuration (fallback)
OPENAI_API_KEY="sk-..."
ANTHROPIC_API_KEY="sk-ant-..."

# Claude Code Integration
CLAUDE_CODE_SESSION_PATH="/path/to/claude-session"
CLAUDE_CODE_PORT="3000"

# OpenAI OAuth (future)
OPENAI_CLIENT_ID="..."
OPENAI_CLIENT_SECRET="..."
```

## Technical Considerations

### Session Management
- Claude session tokens may have expiration
- Need graceful degradation to API keys if session invalid
- Session sharing between Claude Code and Cofounder processes

### Request Proxying
- Maintain OpenAI-compatible request/response format
- Handle rate limiting at session level
- Preserve streaming capabilities for real-time updates

### Error Handling
- Provider-specific error handling
- Fallback mechanisms between providers
- Clear error messages for authentication failures

### Performance
- Minimal overhead for existing API key users
- Efficient session validation and caching
- Async provider initialization

## Benefits

1. **Cost Optimization**: Use Claude subscription instead of per-token billing
2. **Unified Development**: Single launch command for both tools
3. **Real-time Feedback**: Live visualization of changes via Cofounder dashboard
4. **Flexible Authentication**: Multiple auth methods for different use cases
5. **Backward Compatibility**: Existing API key workflows remain functional

## Future Enhancements

1. **Multi-provider Support**: Support multiple auth providers simultaneously
2. **Token Usage Analytics**: Detailed usage tracking across providers
3. **Advanced Session Management**: Token refresh, multi-user sessions
4. **Integration APIs**: Expose Cofounder functionality to Claude Code plugins