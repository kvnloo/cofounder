# Authentication Architecture

## Overview
Multi-provider authentication system supporting both API keys and Claude Code session tokens.

## Architecture Flow
```
Dashboard → API Server → AuthManager → Provider Selection
                                    ├─ API Key Provider
                                    └─ Claude Session Provider
```

## Key Components

### AuthManager (utils/auth/manager.js)
- Central orchestrator for all authentication
- Handles provider initialization and switching
- Maintains active provider reference
- Provides fallback mechanism

### Provider Types
1. **API Key Provider**
   - Direct API key authentication
   - Supports OpenAI and Anthropic
   - Legacy compatible

2. **Claude Session Provider**  
   - Uses Claude Code session tokens
   - Proxies through Claude Code CLI
   - Subscription-based billing

3. **Claude Code CLI Provider** (New)
   - Direct integration with Claude Code
   - Automatic session management
   - Real-time status monitoring

## Provider Interface
All providers implement:
- `initialize()`: Setup provider
- `isHealthy()`: Check availability
- `inference()`: LLM operations
- `vectorize()`: Embeddings (optional)
- `transcribe()`: Audio (optional)

## Configuration
Environment variables:
- `AUTH_PROVIDER`: Select provider type
- `CLAUDE_CODE_PORT`: Claude Code service port
- `ANTHROPIC_API_KEY`: API key (if using)
- `OPENAI_API_KEY`: API key (if using)