# Suggested Commands

## Development Commands
```bash
# Start API server
cd cofounder/api
npm run start

# Start with Claude Code integration
cd cofounder/api
npm run start:with-claude

# Start dashboard
cd cofounder/dashboard
npm run dev

# Install dependencies
npm install
```

## Testing Commands
```bash
# Test authentication system
cd cofounder/api
node test-auth.js
```

## Git Commands
```bash
# Check status
git status

# View recent commits
git log --oneline -10

# View changes
git diff

# Create feature branch
git checkout -b feature/your-feature-name

# Stage and commit
git add .
git commit -m "feat: your commit message"
```

## System Utils
```bash
# Navigate directories
cd [directory]

# List files
ls -la

# Search for files
find . -name "*.js"

# Search in files
grep -r "pattern" .

# View file content
cat [file]
```

## Environment Setup
```bash
# Set authentication provider
export AUTH_PROVIDER=claude-session  # or api-key

# Configure Claude Code port (if different)
export CLAUDE_CODE_PORT=3000
```