# GitHub Copilot Instructions for Biosanarcall Medical System

## Architecture Overview

This is a **modular medical management system** with three main components:
- **Frontend**: React 18 + TypeScript + Vite with shadcn/ui design system
- **Backend**: Node.js + Express + TypeScript with MySQL2 database  
- **MCP Integration**: Python and Node.js MCP (Model Context Protocol) servers for AI agent integration

## Project Structure & Key Patterns

### Frontend (`/frontend/`)
- Uses **shadcn/ui + Radix UI** components exclusively - never write custom UI from scratch
- **React Router 6** with protected routes via `ProtectedRoute` wrapper
- **TanStack Query** for server state management
- **React Hook Form + Zod** validation pattern for all forms
- **Modular patient management** system with 6 specialized components (4-6 fields each)

```tsx
// Standard form pattern used throughout
const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
  resolver: zodResolver(schema)
});
```

### Backend (`/backend/`)
- **Express + TypeScript** with security-first approach (helmet, CORS, rate limiting)
- **MySQL2** with connection pooling - database operations in `/src/db/`
- **JWT authentication** with protected routes middleware pattern
- **File uploads** handled via multer to `/uploads` directory
- **PM2 ecosystem** configuration for production deployment

```typescript
// Standard API route pattern
app.use('/api/patients', authenticateToken, patientRoutes);
```

### MCP Servers Integration
- **Python MCP Server** (`/mcp-server-python/`) - 24 medical tools for AI agents
- **Node.js MCP Server** (`/mcp-server-node/`) - Alternative implementation
- **JSON-RPC 2.0** protocol for AI agent communication
- Production endpoints: `https://biosanarcall.site/mcp-py*`

## Development Workflows

### Frontend Development
```bash
cd frontend && npm run dev    # Vite dev server on port 5173
npm run build                 # Production build with type checking
```

### Backend Development  
```bash
cd backend && npm run dev     # ts-node-dev with auto-reload
npm run db:init              # Initialize database with schema
npm run db:seed              # Create admin user (SEED_ADMIN_* env vars)
npm run db:check             # Test MySQL connection
```

### Critical Environment Variables
```env
# Backend
DB_HOST=127.0.0.1
DB_USER=biosanar_user  
DB_NAME=biosanar
JWT_SECRET=your_secret
CORS_ORIGINS=https://biosanarcall.site

# MCP Servers
BACKEND_BASE=http://127.0.0.1:4000/api
BACKEND_TOKEN=jwt_token_here
```

## Component Patterns & Conventions

### Patient Management System
The system uses a **6-tool modular approach** instead of monolithic forms:
- `PatientBasicInfo` (4 fields) - Name, document, birth date, gender
- `PatientContactInfo` (6 fields) - Phone, email, address, municipality  
- `PatientMedicalInfo` (5 fields) - Blood type, allergies, conditions
- `PatientInsuranceInfo` (3 fields) - EPS, affiliation type
- `PatientDemographicInfo` (5 fields) - Education, marital status, occupation
- `PatientsList` - Search and management interface

### Layout Pattern
All pages use consistent layout with sidebar:
```tsx
<SidebarProvider>
  <AppSidebar />
  <main className="w-full">
    <SidebarTrigger />
    {/* Page content */}
  </main>
</SidebarProvider>
```

### API Client Pattern
Use centralized error handling for 401/404 responses:
```typescript
// Handle expired JWT gracefully
.catch(error => {
  if (error.response?.status === 401) {
    // Redirect to login or refresh token
  }
  console.error('API Error:', error);
});
```

## Database & API Conventions

### Route Structure
- `/api/auth/*` - Authentication endpoints
- `/api/patients/*` - Patient CRUD operations
- `/api/appointments/*` - Scheduling system
- `/api/lookups/*` - Reference data (municipalities, EPS, etc.)

### Standard Response Format
```typescript
// Success response
{ success: true, data: T, message?: string }

// Error response  
{ success: false, error: string, details?: any }
```

## MCP Integration Points

### Tool Categories (24 total)
- **Patient Management**: Search, create, update patients
- **Appointment System**: Schedule, modify, cancel appointments  
- **Analytics**: Daily summaries, statistics, reports
- **Notifications**: Send confirmations, reminders
- **File Operations**: Upload documents, export data

### MCP Client Configuration
```yaml
# For ElevenLabs or other AI agents
server_url: "https://biosanarcall.site/mcp-py-simple"
description: "Medical management with voice optimization (9 core tools)"
```

## Deployment & Production

### PM2 Configuration
Both backend and MCP servers use PM2 with ecosystem files:
```javascript
// Standard PM2 app config
{
  name: 'app-name',
  script: 'dist/server.js',
  env: { NODE_ENV: 'production', PORT: 4000 },
  max_memory_restart: '300M'
}
```

### Nginx Integration
- Frontend served as static files
- Backend proxied to port 4000
- MCP servers on separate endpoints
- SSL/HTTPS required for production

## Common Troubleshooting

- **401 Errors**: Check JWT token expiration and refresh mechanism
- **404 API Endpoints**: Some statistics endpoints may not be implemented - use graceful fallbacks
- **CORS Issues**: Verify `CORS_ORIGINS` environment variable includes your domain
- **Database Connection**: Use `npm run db:check` to verify MySQL connectivity

## Testing Patterns

```bash
# Backend feature testing
npm run test:features

# MCP server testing  
curl -X POST https://biosanarcall.site/mcp-py-simple \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}'
```

Remember: This system prioritizes **modular architecture**, **security-first design**, and **AI agent integration** through MCP protocol.
