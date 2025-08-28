# Code Style and Conventions

## JavaScript/TypeScript Conventions
- **Module System**: ES modules (type: "module")
- **Naming**: 
  - Files: kebab-case (e.g., auth-manager.js, claude-session.js)
  - Classes: PascalCase (e.g., AuthManager, ClaudeSessionProvider)
  - Functions/Methods: camelCase (e.g., initializeProviders, getProviderInfo)
  - Constants: UPPER_SNAKE_CASE
- **Async/Await**: Preferred over promises
- **Error Handling**: Try-catch blocks with proper error messages

## React/TypeScript Conventions
- **Components**: PascalCase files and exports (e.g., AuthSettings.tsx)
- **Hooks**: Use "use" prefix (e.g., useToast)
- **Types**: Interface definitions preferred over type aliases
- **Props**: Destructured in component parameters

## Project Structure
- Logical separation by feature/domain
- Utils folder for shared utilities
- Components organized by type (views, ui, flow)
- Clear provider/manager pattern for extensibility

## Documentation
- Comprehensive inline documentation
- README files for major features
- Integration guides for complex features