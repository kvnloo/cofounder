# Cofounder Database Architecture

## Overview

Cofounder uses a hybrid data storage approach combining embedded databases for local development, cloud storage for files, and optional Firebase integration for user data and collaboration features.

## Storage Strategy

### 1. Local Development Storage
- **PGLite** - Embedded PostgreSQL for generated projects
- **File System** - Local project files and cache
- **In-Memory** - Session state and temporary data

### 2. Production Storage Options
- **PostgreSQL** - Primary database for production deployments
- **Firebase Firestore** - Optional cloud database for user data
- **Google Cloud Storage** - File and asset storage
- **Redis** - Caching and session management (planned)

## Data Architecture

### Project Data Model

#### Project Structure
```typescript
interface Project {
  id: string;                    // Unique project identifier
  name: string;                  // Human-readable project name
  description: string;           // Project description
  timestamp: number;             // Creation timestamp
  status: ProjectStatus;         // Current generation status
  metadata: ProjectMetadata;     // Additional project information
  blueprint: ProjectBlueprint;   // Generated project structure
}

interface ProjectMetadata {
  aesthetics?: string;           // Design preferences
  framework: string;             // Target framework
  database: string;              // Database type
  authentication: string;       // Auth method
  deployment: string;            // Deployment target
}

interface ProjectBlueprint {
  pm: ProductManagement;         // Product management documents
  db: DatabaseSchema;            // Database design
  backend: BackendSpec;          // Backend implementation
  frontend: FrontendSpec;        // Frontend implementation
  ux: UXSpecification;          // User experience design
}
```

#### Generation State
```typescript
interface GenerationState {
  projectId: string;
  sequenceId: string;            // Current workflow sequence
  completedNodes: string[];      // Finished generation steps
  currentNode?: string;          // Active generation step
  failedNodes: string[];         // Failed generation steps
  nodeResults: Record<string, any>; // Results from each node
  timeline: GenerationEvent[];   // Event history
}

interface GenerationEvent {
  timestamp: number;
  nodeId: string;
  type: 'start' | 'complete' | 'error';
  message: string;
  data?: any;
}
```

### Cache Data Model

#### AST Analysis Cache
```typescript
interface ASTCache {
  projectPath: string;
  timestamp: number;
  fileNodes: Map<string, FileNode>;
  connections: Map<string, Connection[]>;
  hierarchy: Map<string, number>;
  importGraph: Map<string, ImportNode>;
  exportGraph: Map<string, ExportNode>;
}

interface FileNode {
  path: string;
  absolutePath: string;
  type: string;
  depth: number;
  imports: ImportSpec[];
  exports: ExportSpec[];
  functions: FunctionDef[];
  classes: ClassDef[];
  variables: VariableDef[];
  connections: Set<string>;
}
```

#### Project Cache
```typescript
interface ProjectCache {
  projectId: string;
  lastUpdated: number;
  structure: DirectoryStructure;
  dependencies: DependencyGraph;
  performance: PerformanceMetrics;
  quality: QualityMetrics;
}
```

## Database Schemas

### Generated Project Databases

When Cofounder generates projects, it creates appropriate database schemas based on the project requirements:

#### User Management Schema
```sql
-- Standard user authentication tables
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Project-Specific Schemas
Generated dynamically based on project requirements through the `db/schemas.js` function:

```javascript
// Example: E-commerce project schema generation
const generateEcommerceSchema = () => ({
  products: {
    id: 'UUID PRIMARY KEY',
    name: 'VARCHAR(255) NOT NULL',
    price: 'DECIMAL(10,2) NOT NULL',
    description: 'TEXT',
    inventory_count: 'INTEGER DEFAULT 0',
    created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
  },
  orders: {
    id: 'UUID PRIMARY KEY', 
    user_id: 'UUID REFERENCES users(id)',
    total_amount: 'DECIMAL(10,2) NOT NULL',
    status: 'VARCHAR(50) DEFAULT "pending"',
    created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
  }
});
```

### Cofounder System Database

#### Project Management Tables
```sql
-- Core project tracking
CREATE TABLE projects (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'initializing',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB,
  blueprint JSONB
);

-- Generation workflow tracking
CREATE TABLE generation_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR(255) REFERENCES projects(id),
  sequence_type VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'running',
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  error_message TEXT
);

-- Individual node execution tracking
CREATE TABLE generation_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID REFERENCES generation_sequences(id),
  node_name VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  result JSONB,
  error_message TEXT
);
```

#### Cache Management Tables
```sql
-- AST analysis cache
CREATE TABLE ast_cache (
  project_path VARCHAR(500) PRIMARY KEY,
  cache_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Project analysis cache  
CREATE TABLE project_cache (
  project_id VARCHAR(255) PRIMARY KEY,
  cache_data JSONB NOT NULL,
  cache_size BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Data Access Patterns

### Project Data Access
```javascript
// cofounder/api/utils/storage.js
class ProjectStorage {
  async createProject(projectData) {
    // Store in local file system for development
    // Store in cloud database for production
  }
  
  async getProject(projectId) {
    // Retrieve from cache first, then storage
  }
  
  async updateProject(projectId, updates) {
    // Update storage and invalidate cache
  }
}
```

### Cache Management
```javascript
// cofounder/api/system/functions/op/project-cache.js
class ProjectCache {
  async set(key, value, ttl = 3600) {
    // Store with time-to-live
  }
  
  async get(key) {
    // Retrieve with automatic cleanup of expired entries
  }
  
  async invalidate(pattern) {
    // Remove cache entries matching pattern
  }
}
```

## Storage Integrations

### Firebase Integration (`utils/firebase.js`)
```javascript
class FirebaseStorage {
  async initializeApp() {
    // Initialize Firebase Admin SDK
  }
  
  async storeDocument(collection, docId, data) {
    // Store in Firestore
  }
  
  async uploadFile(filePath, destination) {
    // Upload to Firebase Storage
  }
}
```

### Google Cloud Storage (`@google-cloud/storage`)
```javascript
class CloudStorage {
  async uploadProject(projectId, files) {
    // Batch upload project files
  }
  
  async downloadProject(projectId, destination) {
    // Download and extract project
  }
}
```

## Data Migration Strategies

### Schema Versioning
```javascript
const migrations = {
  '1.0.0': {
    up: () => {
      // Create initial tables
    },
    down: () => {
      // Rollback changes
    }
  },
  '1.1.0': {
    up: () => {
      // Add new columns
    },
    down: () => {
      // Remove new columns  
    }
  }
};
```

### Data Backup and Recovery
- **Automated Backups** of project data
- **Point-in-time Recovery** for project states
- **Export/Import** functionality for project portability

## Performance Considerations

### Indexing Strategy
```sql
-- Performance indexes
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_created_at ON projects(created_at);
CREATE INDEX idx_generation_nodes_sequence ON generation_nodes(sequence_id);
CREATE INDEX idx_ast_cache_accessed ON ast_cache(last_accessed);
```

### Query Optimization
- **Connection Pooling** for database connections
- **Query Caching** for frequently accessed data
- **Lazy Loading** for large project blueprints
- **Pagination** for project lists

### Cache Strategy
- **Memory Cache** for active project data
- **Disk Cache** for AST analysis results
- **CDN Cache** for static assets
- **Database Query Cache** for repeated queries

## Security Considerations

### Data Protection
- **Encryption at Rest** for sensitive project data
- **Connection Security** with SSL/TLS
- **Access Control** based on user permissions
- **Audit Logging** for data access and modifications

### Backup Security
- **Encrypted Backups** in cloud storage
- **Access Key Rotation** for cloud services
- **Retention Policies** for automated cleanup

## Monitoring and Maintenance

### Health Checks
- **Connection Monitoring** for database availability
- **Cache Hit Rates** for performance optimization
- **Storage Usage** tracking and alerts
- **Query Performance** monitoring

### Automated Maintenance
- **Cache Cleanup** for expired entries
- **Log Rotation** for audit logs
- **Backup Verification** for data integrity
- **Performance Tuning** based on usage patterns

---

*This documentation reflects the current database architecture supporting Cofounder's project generation and management capabilities.*