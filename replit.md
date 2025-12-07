# CodeOrbit

## Overview

CodeOrbit is a browser-based cloud IDE designed for students, indie developers, and beginners. It provides a streamlined coding environment with Monaco editor integration, instant Node.js code execution, and cloud-based project storage. The application emphasizes simplicity and productivity with a clean, modern interface inspired by professional development tools like Replit, CodeSandbox, and VS Code.

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