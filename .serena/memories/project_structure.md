# Project Structure

```
cofounder/
├── apps/                      # Example applications
│   └── cofounder-recursive/   # Recursive app example
├── cofounder/
│   ├── api/                   # Backend API server
│   │   ├── src/              
│   │   │   ├── commands/      # Command handlers
│   │   │   └── analyzers/     # Code analyzers
│   │   ├── system/            # System functions
│   │   ├── utils/             # Utility functions
│   │   │   └── auth/          # Authentication system
│   │   │       ├── manager.js # Auth orchestrator
│   │   │       └── providers/ # Auth providers
│   │   ├── dist/              # Built frontend assets
│   │   ├── db/                # Database files
│   │   └── server.js          # Main server entry
│   ├── dashboard/             # React dashboard
│   │   ├── src/
│   │   │   ├── components/    # React components
│   │   │   │   ├── ui/        # UI components
│   │   │   │   ├── views/     # View components
│   │   │   │   └── flow/      # Flow components
│   │   │   └── App.tsx        # Main app component
│   │   └── package.json
│   ├── boilerplate/           # Project templates
│   ├── visualizer/            # Visualization tools
│   └── docs/                  # Documentation
│       ├── product-strategy/  # BRD, PRD
│       ├── requirements/      # DRD, FRD
│       └── ux-design/         # UX documentation
├── benchmarks/                # Performance tests
└── README.md                  # Main documentation
```

## Key Integration Files
- `claude-code-launcher.js`: Unified launcher for Claude Code + Cofounder
- `utils/claude-code-integration.js`: Claude Code integration logic
- `utils/auth/providers/claude-code-cli.js`: Claude CLI auth provider
- `components/views/auth-settings.tsx`: Auth UI component