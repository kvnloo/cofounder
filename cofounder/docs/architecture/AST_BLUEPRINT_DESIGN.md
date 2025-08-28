# AST-Based Blueprint System Design

## Vision
Transform the blueprint view into a dynamic, context-aware code dependency visualization that helps developers understand file connections and relevance during coding sessions.

## Implementation Status
✅ **IMPLEMENTED**: Core AST analysis system is now live in `cofounder/api/system/functions/op/ast-analyzer.js`  
✅ **FEATURES**: Babel-based parsing, import/export tracking, file hierarchy analysis  
🔄 **IN PROGRESS**: Frontend visualization integration and depth controls  
📋 **PLANNED**: Context highlighting and real-time file tracking

## Core Requirements

### 1. Tree Depth Control
- **Slider Control**: Dynamically filter nodes by importance/depth
- **Hierarchy Levels**:
  - Level 0: High-level specs (PRD, FRD, DRD, main entry points)
  - Level 1: Core files (server.js, App.tsx, main components)  
  - Level 2: Feature modules, utilities, services
  - Level 3: Helper functions, constants, types
  - Level 4+: Deep implementation details

### 2. Dynamic Canvas Layout
- **Responsive Padding**: Calculate spacing based on canvas size and node count
- **Auto-clustering**: Group related files into visual clusters
- **Zoom-adaptive Labels**: Show more detail when zoomed in

### 3. Real AST Analysis
Instead of regex parsing, use proper AST parsers:
- **JavaScript/TypeScript**: Use `@babel/parser` or `typescript` compiler
- **Python**: Current `ast` module (already working)
- **Other Languages**: Add parsers as needed

### 4. Enhanced Connection Types
Track multiple relationship types:
- **Imports/Exports**: Static dependencies
- **Function Calls**: Dynamic relationships  
- **Type References**: TypeScript type dependencies
- **Configuration**: Environment variables, config files
- **Data Flow**: Props, state, API calls

### 5. Dynamic Context System
- **Active File Tracking**: Highlight files related to currently editing file
- **Claude Integration**: When Claude edits a file, show all connected files
- **Smart Filtering**: Show only relevant connections based on context

## Technical Architecture

### Enhanced AST Analyzer (✅ IMPLEMENTED)

```javascript
class ASTAnalyzer {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.fileNodes = new Map();        // file_path -> ASTNode
    this.connections = new Map();      // source_file -> [connections]
    this.hierarchy = new Map();        // file_path -> depth_level
    this.importGraph = new Map();      // import dependency tracking
    this.exportGraph = new Map();      // export dependency tracking
  }

  async analyzeFile(filePath) {
    // ✅ Real Babel AST parsing with comprehensive plugin support
    const ast = parse(content, {
      sourceType: 'unambiguous',
      plugins: [
        'jsx', 'typescript', 'decorators-legacy', 'classProperties',
        'dynamicImport', 'exportDefaultFrom', 'exportNamespaceFrom',
        'asyncGenerators', 'functionBind', 'functionSent',
        'objectRestSpread', 'optionalCatchBinding', 'optionalChaining',
        'nullishCoalescingOperator'
      ],
      errorRecovery: true
    });

    const node = {
      path: relativePath,
      absolutePath: filePath,
      type: this.getFileType(filePath),
      depth: this.calculateDepth(relativePath),
      imports: [],      // ✅ Static and dynamic imports
      exports: [],      // ✅ All export types
      functions: [],    // ✅ Function declarations and expressions
      classes: [],      // ✅ Class definitions and methods
      variables: [],    // ✅ Variable declarations
      connections: new Set()
    };
    
    // ✅ Comprehensive AST traversal for:
    // - ImportDeclaration (static imports)
    // - CallExpression (dynamic imports) 
    // - ExportNamedDeclaration, ExportDefaultDeclaration
    // - FunctionDeclaration, FunctionExpression, ArrowFunctionExpression
    // - ClassDeclaration with methods
    // - VariableDeclarator tracking
    
    this.fileNodes.set(filePath, node);
    return node;
  }

  calculateDepth(filePath) {
    // ✅ Implemented depth calculation algorithm
    if (this.isConfigFile(filePath)) return 0;     // Config, specs
    if (this.isMainEntry(filePath)) return 1;      // server.js, main.tsx
    if (this.isComponentFile(filePath)) return 2;  // React components
    if (this.isUtilityFile(filePath)) return 3;    // Utils, helpers
    return 4; // Deep implementation details
  }

  // ✅ File categorization methods implemented:
  // - isConfigFile, isMainEntry, isComponentFile, isUtilityFile
  // - resolveImportPath for relative/absolute path resolution
  // - Comprehensive project structure analysis
}
```

### Dynamic Layout System

```javascript
class DynamicLayout {
  constructor(canvasSize, nodeCount, depthLevel) {
    this.canvasSize = canvasSize;
    this.nodeCount = nodeCount;
    this.depthLevel = depthLevel;
  }

  calculateSpacing() {
    const baseSpacing = Math.max(80, this.canvasSize.width / Math.sqrt(this.nodeCount));
    const depthMultiplier = Math.max(0.5, (5 - this.depthLevel) / 5);
    return baseSpacing * depthMultiplier;
  }

  layoutNodes(nodes, connections) {
    // Use force-directed layout with depth-based clustering
    // Group files by type/directory/importance
    // Apply physics-based positioning
  }
}
```

### Depth Control Component

```jsx
function DepthSlider({ maxDepth, currentDepth, onChange }) {
  const depthLabels = [
    "Specs & Entry Points",
    "Core Files", 
    "Feature Modules",
    "Utilities",
    "Implementation Details"
  ];

  return (
    <div className="depth-control">
      <Slider 
        min={0} 
        max={maxDepth} 
        value={currentDepth}
        onChange={onChange}
        marks={depthLabels.map((label, i) => ({ value: i, label }))}
      />
      <div className="stats">
        Showing {visibleNodeCount} of {totalNodeCount} files
      </div>
    </div>
  );
}
```

### Context Highlighting System

```javascript
class ContextHighlighter {
  constructor(astAnalyzer, activeFile) {
    this.analyzer = astAnalyzer;
    this.activeFile = activeFile;
  }

  getRelatedFiles(maxDepth = 2) {
    const related = new Set();
    this.findRelatedRecursive(this.activeFile, related, maxDepth);
    return Array.from(related);
  }

  findRelatedRecursive(filePath, visited, depth) {
    if (depth <= 0 || visited.has(filePath)) return;
    
    visited.add(filePath);
    const node = this.analyzer.fileNodes.get(filePath);
    
    if (node) {
      // Add imported files
      node.imports.forEach(imp => 
        this.findRelatedRecursive(imp, visited, depth - 1));
      
      // Add files that import this file
      this.analyzer.getImporters(filePath).forEach(imp =>
        this.findRelatedRecursive(imp, visited, depth - 1));
    }
  }
}
```

## Implementation Plan

### Phase 1: Enhanced AST Analysis ✅ COMPLETED
1. ✅ Replace regex parsing with real AST parsers (Babel integration)
2. ✅ Extract comprehensive file relationships (imports, exports, functions)
3. ✅ Calculate file importance/depth scores (4-level hierarchy)

### Phase 2: Dynamic Layout 🔄 IN PROGRESS
1. ✅ Basic depth filtering system implemented
2. 🔄 Enhanced depth filtering slider (components/flow/controls/depth-slider.tsx)
3. 🔄 Dynamic layout calculator (components/flow/utils/dynamic-layout.tsx)
4. 📋 Advanced clustered node positioning

### Phase 3: Context Integration 📋 PLANNED
1. 📋 Track active file from Claude Code
2. 📋 Implement real-time highlighting
3. 📋 Add connection filtering
4. 📋 Integration with Serena MCP session management

### Phase 4: Advanced Features 📋 FUTURE
1. 📋 Search and navigation within flow view
2. 📋 File content previews on hover/click  
3. 📋 Performance optimizations for large projects (1000+ files)
4. 📋 Collaborative highlighting for team development

## Current Integration Points

### API Integration
- `POST /api/project/analyze` - Triggers AST analysis via analyze.js
- Server-side AST analysis integrated with project workflow
- Results cached using project-cache.js system

### Frontend Integration  
- React Flow based visualization in `dashboard/src/components/views/flow.tsx`
- Custom flow nodes in `components/flow/nodes/cofounder-node.tsx`
- Depth controls partially implemented
- Real-time updates via Socket.IO integration

## Benefits

1. **Scalability**: Handle hundreds of files without overwhelming UI
2. **Context Awareness**: Always show relevant files for current work
3. **Developer Productivity**: Quickly understand codebase structure
4. **Claude Integration**: Enhanced AI coding with visual context
5. **Educational**: Help new developers understand project architecture

This system transforms the static blueprint into a living, breathing representation of your codebase that adapts to your workflow.