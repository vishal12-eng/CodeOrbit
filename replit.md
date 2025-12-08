# NovaCode IDE

## Overview

NovaCode IDE is a comprehensive AI-powered cloud development environment comparable to Replit, Cursor AI, and Bolt. It provides a browser-based coding environment with Monaco editor integration, multi-language support, real-time code execution with streaming output, integrated AI assistance with multiple models (GPT-4, Claude, Gemini, Grok), and WebSocket-based real-time features. The application emphasizes simplicity and productivity with a clean, modern interface.

## Recent Changes (December 2025)

### Phase 1: WebSocket Streaming
- Created `server/websocket.ts` with real-time streaming for terminal, runner logs, AI output, and console
- Project-based connection grouping with heartbeat mechanism

### Phase 2: Multi-Language Templates
- Added Go, Java, C++, and Rust project templates to `server/ai/oneshot.ts`
- Each template includes proper entry files, build configs, and guidelines

### Phase 3: Environment Variables System
- Added `envVars` field to projects schema
- API endpoints: GET/POST/DELETE for `/api/projects/:id/env`
- Created `EnvVarsPanel.tsx` frontend component

### Phase 4: Authentication
- Removed demo-user hardcoding
- Proper Replit OIDC authentication with session-based auth

### Phase 5: AI Model Integrations
- Integrated Gemini (Google Generative AI SDK)
- Integrated Grok/xAI (OpenAI-compatible API)
- Both support streaming and JSON generation

### Phase 6: Git Backend
- Created `server/git.ts` with simple-git integration
- Full Git API: init, status, add, commit, log, branches, checkout, branch

### Phase 7: Image & Audio Generation
- Added DALL-E 3 image generation endpoint
- Added OpenAI TTS audio generation endpoint
- Created `ImageAudioGenerator.tsx` component

### Phase 8: Undo/Redo
- Exposed Monaco undo/redo via CodeEditor ref
- Added Undo/Redo buttons to editor toolbar

### Phase 9: Code Formatter
- Created `server/formatter.ts` with Prettier integration
- Added `/api/format` endpoint
- Format button in editor toolbar

### Phase 10: API Key Management & Security
- **API Key Management**: Encrypted storage for OpenAI, Anthropic, Google, and custom API keys
  - Endpoints: GET/POST/DELETE `/api/keys`
  - Encryption: AES-256-CBC with required ENCRYPTION_SECRET environment variable
  - UI: Settings page with add/delete functionality

- **Project Sharing**: Secure share tokens for public project access
  - Enable sharing: POST `/api/projects/:id/share` (requires ownership)
  - Disable sharing: DELETE `/api/projects/:id/share`
  - Public access: GET `/api/shared/:token`

- **ZIP Import**: Bulk project import from ZIP files
  - Endpoint: POST `/api/projects/import-zip`
  - Security: Path traversal prevention, blacklisted extensions/directories
  - Size limits: 50MB max ZIP, 1MB per file

- **Project Analytics**: GET `/api/projects/:id/analytics`
  - Metrics: Lines of code, file count, language, project type

- **Rate Limiting**: Code execution rate limiting (30 req/min per IP)
  - Applied to both `/api/run/:projectId` and `/api/run/:projectId/stream`
  - Memory cleanup via periodic eviction

- **Security Improvements**:
  - Required ENCRYPTION_SECRET environment variable (32+ characters)
  - Ownership verification for share and analytics operations
  - API key ownership verification on delete
  - Path sanitization for ZIP imports
  - Provider enum validation for API keys

### Phase 11: Bolt-Style AI Response Engine (Latest)
- **Structured AI Response System**:
  - Created `shared/aiSchema.ts` with types for structured AI responses
  - `server/ai/formatResponse.ts` parses AI text into organized sections (Goal, Plan, Actions, Implementation, QA, Result)
  - `server/ai/systemPrompts.ts` with Bolt-style system prompts

- **New AI Components** (`client/src/components/ai/`):
  - `AIMessage.tsx`: Renders structured messages with typewriter animation
  - `FileActionChip.tsx`: Color-coded file action chips (read/write/create/delete)
  - `ActionList.tsx`: Groups and displays file actions by type
  - `AIHeader.tsx`: Shows model info, mode, and action counts
  - `AIStreamingRenderer.tsx`: Real-time streaming response renderer

- **AIPanel Enhancements**:
  - New "Builder" panel mode with structured response rendering
  - Mode toggle between Chat (traditional) and Builder (Bolt-style)
  - Integrated AIHeader and AIMessage components
  - File action tracking and display

- **Backend Updates**:
  - New endpoint: POST `/api/ai/chat/structured` for builder mode
  - Returns parsed sections, file actions, and metadata
  - SSE stream endpoint: GET `/api/ai/chat/stream` (placeholder)

## Environment Variables

Required for production:
- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Session encryption secret
- `REPLIT_DOMAINS`: Comma-separated allowed domains
- `ENCRYPTION_SECRET`: API key encryption secret (32+ characters, required)

Optional AI integrations:
- `OPENAI_API_KEY`: OpenAI API key for GPT models and DALL-E
- `ANTHROPIC_API_KEY`: Anthropic API key for Claude models
- `GOOGLE_GENERATIVE_AI_API_KEY`: Google API key for Gemini
- `XAI_API_KEY`: xAI API key for Grok

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Tooling**
- React 18+ with TypeScript for type safety and modern development
- Vite as the build tool and development server for fast HMR and optimized builds
- Wouter for lightweight client-side routing
- TanStack Query (React Query) for server state management and caching

**UI Component System**
- Radix UI primitives for accessible, unstyled components
- shadcn/ui component library built on Radix UI with Tailwind CSS
- Custom design system following the "new-york" style variant
- Framer Motion for animations and page transitions

**Styling Approach**
- Tailwind CSS with custom configuration for consistent design tokens
- CSS variables for theme support (light/dark modes)
- Custom color system with HSL values for flexible theming
- Typography system using Inter (UI) and JetBrains Mono (code) fonts from Google Fonts

**State Management**
- React Context API for global state (Theme, Auth)
- TanStack Query for server-side data with automatic caching and revalidation
- Local component state for UI interactions

**Code Editor**
- Monaco Editor (VS Code's editor) via @monaco-editor/react
- Full syntax highlighting and IntelliSense support
- Theme synchronization with application theme

### Backend Architecture

**Server Framework**
- Express.js with TypeScript for type-safe API development
- HTTP server created with Node's built-in `http` module
- Custom middleware for request logging and JSON parsing

**Authentication**
- OpenID Connect (OIDC) integration with Replit's authentication service
- Passport.js with openid-client strategy
- Session-based authentication using express-session
- PostgreSQL session store via connect-pg-simple for persistent sessions

**API Design**
- RESTful API endpoints under `/api` prefix
- Authentication middleware (`isAuthenticated`) protecting routes
- JSON request/response format
- Error handling with appropriate HTTP status codes

**Code Execution**
- Server-side code execution using Node.js `child_process.spawn`
- Temporary directory creation for isolated execution environments
- Capture of stdout, stderr, and execution time
- Automatic cleanup of temporary execution directories

### Data Storage

**Database**
- PostgreSQL as the primary database
- Drizzle ORM for type-safe database queries and migrations
- Schema-first approach with Drizzle-Zod integration for validation

**Data Models**
- **Users**: Authentication info, profile data, preferences (theme, editor settings, auto-save)
- **Projects**: Owner reference, name, language, file tree structure (JSONB), timestamps
- **Sessions**: Managed by connect-pg-simple for authentication persistence

**File Structure Storage**
- Hierarchical file/folder structure stored as JSONB in PostgreSQL
- Recursive `FileNode` schema supporting nested folders and files
- In-memory representation on client with path-based file access

### Key Architectural Decisions

**Monorepo Structure**
- Single repository with client, server, and shared code
- Shared schema definitions between frontend and backend via `/shared` directory
- TypeScript path aliases for clean imports (`@/`, `@shared/`)

**Build Strategy**
- Separate Vite build for client (outputs to `dist/public`)
- esbuild for server bundling with selective dependency bundling
- Allowlist approach for bundling specific server dependencies to reduce cold start times
- Production build combines both into single deployable artifact

**Development Experience**
- Hot Module Replacement (HMR) in development via Vite
- Replit-specific plugins for development (cartographer, dev banner, runtime error modal)
- Custom Vite middleware mode for seamless client-server integration
- TypeScript strict mode for maximum type safety

**Code Organization**
- Feature-based organization for UI components (editor/, layout/, ui/)
- Separation of concerns: storage layer abstracts database operations
- Custom hooks for reusable logic (useAuth, useTheme, useMobile)
- Context providers for cross-cutting concerns

## External Dependencies

**Third-Party UI Libraries**
- Radix UI component primitives (40+ packages for dialogs, dropdowns, tooltips, etc.)
- Monaco Editor for code editing capabilities
- Framer Motion for declarative animations
- Lucide React for consistent iconography

**Authentication & Session Management**
- openid-client for OIDC authentication flow
- Passport.js for authentication strategy management
- connect-pg-simple for PostgreSQL-backed session storage
- express-session for session middleware

**Database & ORM**
- PostgreSQL database (provisioned via DATABASE_URL environment variable)
- Drizzle ORM for database access and migrations
- node-postgres (pg) for PostgreSQL driver
- Drizzle-Zod for schema validation

**Development Tools**
- Replit-specific Vite plugins for enhanced development experience
- ESBuild for production server bundling
- TSX for TypeScript execution in development

**Validation & Utilities**
- Zod for runtime type validation and schema definitions
- date-fns for date formatting and manipulation
- nanoid for unique ID generation
- class-variance-authority and clsx for conditional CSS class handling