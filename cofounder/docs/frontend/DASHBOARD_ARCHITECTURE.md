# Cofounder Dashboard Architecture

## Overview

The Cofounder Dashboard is a React 18 + TypeScript application that provides real-time visualization and management of AI-powered project generation. Built with modern web technologies, it offers an intuitive interface for creating, monitoring, and managing full-stack applications.

## Technology Stack

### Core Framework
- **React 18** - Latest React with concurrent features
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and development server
- **React Router DOM** - Client-side routing

### State Management
- **Redux Toolkit** - Modern Redux with simplified API
- **Redux Persist** - State persistence across sessions
- **Redux Thunk** - Async action handling

### UI Components
- **Radix UI Primitives** - Accessible, unstyled components
- **Shadcn/UI** - Beautiful, customizable component system
- **Tailwind CSS** - Utility-first styling framework
- **Framer Motion** - Smooth animations and transitions

### Specialized Features
- **@xyflow/react** - Interactive flow diagrams and project visualization
- **Socket.IO Client** - Real-time communication with backend
- **React Hook Form + Zod** - Form handling with validation
- **React Speech Recognition** - Voice input capabilities

## Architecture Overview

```
src/
├── components/          # React components
│   ├── flow/           # React Flow visualization
│   ├── ui/             # Shadcn UI components
│   └── views/          # Page-level components
├── hooks/              # Custom React hooks  
├── store/              # Redux store configuration
├── lib/                # Utility libraries
└── App.tsx             # Main application component
```

## Component Architecture

### 1. Flow Visualization (`components/flow/`)

#### Core Flow Components
- **`flow.tsx`** - Main flow visualization container using @xyflow/react
- **`template.tsx`** - Flow templates and layouts
- **`keymap.tsx`** - Keyboard shortcuts and controls

#### Custom Nodes (`nodes/`)
- **`cofounder-node.tsx`** - Custom node component for project elements
- **`cofounder-iframe.tsx`** - Embedded iframe nodes for previews
- **`cofounder-terminal.tsx`** - Terminal output nodes
- **`color-selector.tsx`** - Color picker for node customization

#### Flow Controls (`controls/`)
- **`depth-slider.tsx`** - Control project visualization depth levels

#### Flow Utilities (`utils/`)
- **`dynamic-layout.tsx`** - Dynamic layout calculation algorithms

#### Flow Helpers (`helpers/`)
- **`FloatingEdge.tsx`** - Custom edge components
- **`FloatingConnectionLine.tsx`** - Connection line styling
- **`utils.js`** - Flow utility functions

### 2. View Components (`components/views/`)

#### Main Views
- **`flow.tsx`** - Project flow visualization page
- **`projects-list.tsx`** - Project listing and creation
- **`project.tsx`** - Individual project management
- **`settings.tsx`** - Application settings
- **`sidebar.tsx`** - Navigation sidebar

#### Specialized Views
- **`auth-settings.tsx`** - Authentication provider management
- **`component-designer.tsx`** - UI component design tool
- **`events.tsx`** - System events and logging

### 3. UI Components (`components/ui/`)

Complete Shadcn/UI component library:
- **Form Components**: `button.tsx`, `input.tsx`, `textarea.tsx`, `select.tsx`
- **Layout**: `card.tsx`, `dialog.tsx`, `sheet.tsx`, `tabs.tsx`
- **Data Display**: `table.tsx`, `badge.tsx`, `progress.tsx`
- **Navigation**: `menubar.tsx`, `breadcrumb.tsx`, `pagination.tsx`
- **Feedback**: `toast.tsx`, `alert.tsx`, `skeleton.tsx`

## State Management Architecture

### Redux Store Structure (`store/main.tsx`)

```typescript
interface AppState {
  project: string;              // Current project ID
  streamEvents: object;         // Real-time event stream
  projectData: object;          // Project generation data
  nodesKeys: string[];          // Flow node identifiers
  nodesKeysDict: object;        // Node lookup dictionary
  loading: {                    // Loading state management
    isLoading: boolean;
    progress: number;
    message: string;
    error: any;
  };
}
```

### Key Reducers
- **`setProject`** - Set active project and subscribe to updates
- **`resetProject`** - Clear project state
- **`loadProjectState`** - Load saved project data
- **`updateProjectState`** - Handle real-time updates
- **`setLoading`** - Manage loading states

### Real-time Integration

#### Socket.IO Integration
```typescript
const socket = io("http://localhost:4200");

// Auto-subscribe to project updates when project changes
socket.emit("subscribe", projectId);

// Handle real-time events
socket.on("project:update", handleProjectUpdate);
socket.on("generation:progress", updateProgress);
socket.on("generation:complete", handleComplete);
```

## Key Features

### 1. Project Flow Visualization
- **Interactive Flow Diagram** using @xyflow/react
- **Custom Node Types** for different project elements
- **Dynamic Layout** with responsive positioning
- **Depth Control** for managing visualization complexity
- **Real-time Updates** reflecting generation progress

### 2. Project Management
- **Project Creation** with voice input support
- **Project Import** from existing codebases
- **Project Listing** with search and filtering
- **Project Resume** for interrupted generations

### 3. Authentication Management
- **Multi-provider Support** (API Key, Claude Session, Claude Code CLI)
- **Real-time Status** showing auth provider health
- **Provider Switching** via intuitive UI
- **Configuration Display** for debugging

### 4. Real-time Monitoring
- **Live Progress Tracking** during project generation
- **Stream Event Display** for detailed monitoring  
- **Error Handling** with user-friendly messages
- **Performance Metrics** and system health

## Development Patterns

### Component Structure
```typescript
interface ComponentProps {
  // Strongly typed props
}

const Component: React.FC<ComponentProps> = ({ prop1, prop2 }) => {
  // Hooks at the top
  const [state, setState] = useState();
  const dispatch = useDispatch();
  
  // Event handlers
  const handleEvent = useCallback(() => {
    // Logic here
  }, [dependencies]);
  
  // Render
  return (
    <div className="tailwind-classes">
      {/* JSX content */}
    </div>
  );
};
```

### Custom Hooks (`hooks/`)
- **`use-toast.ts`** - Toast notification management
- **`use-generation-progress.ts`** - Project generation progress tracking

### Styling Approach
- **Utility-First**: Tailwind CSS for rapid development
- **Component Variants**: Class Variance Authority for component variations
- **Design System**: Consistent spacing, colors, and typography
- **Responsive Design**: Mobile-first responsive layouts

## Build Configuration

### Vite Configuration (`vite.config.ts`)
```typescript
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:4200'
    }
  }
});
```

### TypeScript Configuration
- **Strict Mode** enabled for type safety
- **Path Mapping** for clean imports (`@/components/...`)
- **React JSX Transform** for optimized builds

## Performance Optimizations

### Code Splitting
- **Lazy Loading** for route components
- **Dynamic Imports** for heavy dependencies
- **Bundle Analysis** for optimization opportunities

### React Optimizations
- **useMemo/useCallback** for expensive computations
- **React.memo** for component memoization
- **Virtualization** for large lists (planned)

### State Management
- **Redux DevTools** for debugging
- **State Persistence** for user preferences
- **Selective Re-renders** via proper selector usage

## Development Workflow

### Available Scripts
```bash
npm run dev      # Development server with hot reload
npm run build    # Production build
npm run lint     # ESLint code linting
npm run preview  # Preview production build
```

### Code Quality
- **ESLint** with React and TypeScript rules
- **Prettier** for consistent formatting
- **TypeScript** for compile-time error checking
- **Git Hooks** for pre-commit validation

## Integration Points

### Backend API Integration
- **REST API** calls via fetch/axios
- **WebSocket** integration for real-time updates  
- **Authentication** token management
- **Error Handling** with user feedback

### AI Service Integration
- **Claude Code Bridge** for AI operations
- **Multi-provider Auth** for different AI services
- **Real-time Progress** tracking for AI operations

## Future Enhancements

### Planned Features
- **Collaborative Editing** for team development
- **Advanced Visualization** with 3D project views
- **Performance Analytics** dashboard
- **Accessibility Improvements** (WCAG 2.1 compliance)

### Technical Improvements
- **Service Worker** for offline capabilities
- **PWA Features** for mobile experience
- **Advanced Caching** strategies
- **Bundle Optimization** for faster loading

---

*This documentation reflects the current dashboard architecture as analyzed from the latest codebase structure.*