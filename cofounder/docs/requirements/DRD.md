# Data Requirements Document (DRD)
# Cofounder Platform

## Data Architecture Overview
The Cofounder platform manages complex data relationships between users, projects, generated code, and AI interactions. This document outlines all data requirements, structures, and relationships.

## Core Data Entities

### 1. User Entity
```typescript
User {
  id: UUID
  email: string (unique)
  username: string (unique)
  passwordHash: string
  role: enum ['admin', 'developer', 'viewer']
  apiKeys: {
    openai?: encrypted_string
    anthropic?: encrypted_string
    claudeSession?: encrypted_string
  }
  preferences: JSON
  createdAt: timestamp
  updatedAt: timestamp
  lastLogin: timestamp
  isActive: boolean
}
```

### 2. Project Entity
```typescript
Project {
  id: UUID
  name: string
  description: text
  userId: UUID (FK -> User)
  path: string
  status: enum ['pending', 'generating', 'completed', 'failed']
  blueprint: JSON
  metadata: {
    language: string
    framework: string
    database: string
    deployment: string
  }
  isMetaProject: boolean
  createdAt: timestamp
  updatedAt: timestamp
  lastGenerated: timestamp
}
```

### 3. Generation Entity
```typescript
Generation {
  id: UUID
  projectId: UUID (FK -> Project)
  type: enum ['PRD', 'FRD', 'BRD', 'DRD', 'UXSMD', 'UXDMD', 'schema', 'api', 'frontend', 'backend']
  status: enum ['queued', 'processing', 'completed', 'failed']
  input: JSON
  output: JSON
  tokens: {
    prompt: integer
    completion: integer
    total: integer
  }
  provider: string
  model: string
  startTime: timestamp
  endTime: timestamp
  error: text?
}
```

### 4. Document Entity
```typescript
Document {
  id: UUID
  projectId: UUID (FK -> Project)
  type: enum ['PRD', 'FRD', 'BRD', 'DRD', 'UXSMD', 'UXDMD', 'README']
  title: string
  content: text
  version: integer
  status: enum ['draft', 'review', 'approved', 'archived']
  createdAt: timestamp
  updatedAt: timestamp
  createdBy: UUID (FK -> User)
  approvedBy: UUID? (FK -> User)
}
```

### 5. Schema Entity
```typescript
DatabaseSchema {
  id: UUID
  projectId: UUID (FK -> Project)
  name: string
  tables: JSON [
    {
      name: string
      columns: [
        {
          name: string
          type: string
          constraints: string[]
          references?: {table: string, column: string}
        }
      ]
      indexes: string[]
      relationships: JSON
    }
  ]
  version: integer
  createdAt: timestamp
  updatedAt: timestamp
}
```

### 6. API Specification Entity
```typescript
APISpec {
  id: UUID
  projectId: UUID (FK -> Project)
  type: enum ['openapi', 'asyncapi', 'graphql']
  version: string
  spec: JSON
  endpoints: [
    {
      path: string
      method: string
      description: string
      parameters: JSON
      responses: JSON
    }
  ]
  createdAt: timestamp
  updatedAt: timestamp
}
```

### 7. Component Entity
```typescript
Component {
  id: UUID
  projectId: UUID (FK -> Project)
  name: string
  type: enum ['view', 'component', 'layout', 'store', 'service']
  path: string
  code: text
  dependencies: string[]
  props: JSON
  state: JSON
  methods: JSON
  createdAt: timestamp
  updatedAt: timestamp
}
```

### 8. Generation Log Entity
```typescript
GenerationLog {
  id: UUID
  generationId: UUID (FK -> Generation)
  level: enum ['info', 'warning', 'error', 'debug']
  message: text
  context: JSON
  timestamp: timestamp
}
```

### 9. Collaboration Entity
```typescript
Collaboration {
  id: UUID
  projectId: UUID (FK -> Project)
  userId: UUID (FK -> User)
  permission: enum ['view', 'edit', 'admin']
  invitedBy: UUID (FK -> User)
  acceptedAt: timestamp?
  createdAt: timestamp
}
```

### 10. Audit Trail Entity
```typescript
AuditLog {
  id: UUID
  userId: UUID (FK -> User)
  action: string
  entity: string
  entityId: UUID
  oldValue: JSON?
  newValue: JSON?
  ipAddress: string
  userAgent: string
  timestamp: timestamp
}
```

## Data Relationships

### Primary Relationships
- **User → Projects**: One-to-Many
- **Project → Generations**: One-to-Many
- **Project → Documents**: One-to-Many
- **Project → Components**: One-to-Many
- **Project → DatabaseSchemas**: One-to-Many
- **Project → APISpecs**: One-to-Many
- **Generation → GenerationLogs**: One-to-Many
- **User → Collaborations**: One-to-Many
- **Project → Collaborations**: One-to-Many

### Secondary Relationships
- **Document → User** (creator): Many-to-One
- **Document → User** (approver): Many-to-One
- **Collaboration → User** (inviter): Many-to-One
- **AuditLog → User**: Many-to-One

## Data Storage Requirements

### Primary Database (PostgreSQL)
- All structured data entities
- Transactional consistency
- ACID compliance
- Indexed for performance
- Regular backups

### Document Storage (File System/S3)
- Generated code files
- Static assets
- Large JSON documents
- Build artifacts
- Logs and traces

### Cache Layer (Redis)
- Session data
- API responses
- Generation progress
- Real-time collaboration state
- Rate limiting counters

### Search Index (Elasticsearch)
- Project search
- Code search
- Documentation search
- Log analysis
- Analytics data

## Data Security Requirements

### Encryption
- **At Rest**: AES-256 encryption for sensitive data
- **In Transit**: TLS 1.3 for all communications
- **API Keys**: Encrypted with user-specific keys
- **Passwords**: Bcrypt hashing with salt

### Access Control
- Row-level security in PostgreSQL
- API key scoping
- JWT token validation
- Rate limiting per user
- IP whitelisting for enterprise

### Compliance
- GDPR data privacy
- Right to deletion
- Data portability
- Audit logging
- Regular security audits

## Data Retention Policies

### Active Data
- User accounts: Indefinite while active
- Projects: Indefinite while account active
- Generations: 90 days detailed logs
- Documents: Version history for 1 year

### Archived Data
- Deleted projects: 30 days recovery period
- Generation logs: Compressed after 90 days
- Audit logs: 2 years retention
- Analytics: Aggregated after 1 year

## Performance Requirements

### Query Performance
- User queries: < 100ms
- Project list: < 200ms
- Generation status: < 50ms
- Search results: < 500ms

### Data Volume Expectations
- Users: 100,000+
- Projects per user: 50 average
- Generations per project: 100 average
- Storage per project: 100MB average

## Backup and Recovery

### Backup Strategy
- **Database**: Daily full backup, hourly incremental
- **Files**: Daily snapshot to S3
- **Critical Data**: Real-time replication
- **Retention**: 30 days rolling backups

### Recovery Objectives
- **RPO** (Recovery Point Objective): 1 hour
- **RTO** (Recovery Time Objective): 4 hours
- **Disaster Recovery**: Multi-region failover
- **Data Validation**: Automated integrity checks