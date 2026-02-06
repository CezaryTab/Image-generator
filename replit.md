# Pixel Art Converter

## Overview

A browser-based web tool that converts uploaded images into minimalistic 36x36 pixel art using a fixed 8-color palette. All image processing happens client-side using HTML Canvas. Users can upload PNG/JPG images, adjust processing options, preview results in real-time, and export the final pixel art.

The application features:
- Center-crop and downscale to 36x36 pixels
- Fixed 8-color palette (Red, Orange, Yellow, Green, Cyan, Blue, Purple, Pink)
- Color distance matching with configurable closeness threshold
- Fallback modes for colors that don't match the palette (transparent or nearest color)
- Symmetry options (none, vertical, horizontal)
- PNG export functionality

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state, React useState for local state
- **Styling**: Tailwind CSS with shadcn/ui component library (New York style)
- **Build Tool**: Vite with React plugin

### Backend Architecture
- **Framework**: Express 5 running on Node.js
- **Architecture Pattern**: RESTful API with `/api` prefix for all routes
- **Development**: Hot module replacement via Vite middleware in development
- **Production**: Static file serving from built assets

### Data Storage
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` for shared type definitions
- **Migrations**: Drizzle Kit for database migrations (`migrations/` directory)
- **Development Storage**: In-memory storage class (`MemStorage`) for development/testing

### Project Structure
```
├── client/           # React frontend application
│   ├── src/
│   │   ├── components/ui/  # shadcn/ui components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── lib/            # Utilities and processors
│   │   └── pages/          # Page components
├── server/           # Express backend
│   ├── index.ts      # Server entry point
│   ├── routes.ts     # API route definitions
│   ├── storage.ts    # Data storage interface
│   └── vite.ts       # Vite dev server integration
├── shared/           # Shared code between client/server
│   └── schema.ts     # Database schema and types
└── migrations/       # Database migrations
```

### Key Design Decisions
1. **Client-side image processing**: All pixel art conversion happens in the browser using Canvas API, eliminating server load for image processing
2. **Shared schema**: TypeScript types generated from Drizzle schema ensure type safety across frontend and backend
3. **Component library**: shadcn/ui provides accessible, customizable components with Radix UI primitives
4. **Path aliases**: `@/` maps to client source, `@shared/` maps to shared code

## External Dependencies

### Database
- **PostgreSQL**: Primary database (requires `DATABASE_URL` environment variable)
- **Drizzle ORM**: Database operations and type generation
- **connect-pg-simple**: PostgreSQL session store (available but not currently active)

### UI Framework
- **Radix UI**: Headless UI primitives for accessible components
- **Tailwind CSS**: Utility-first CSS framework
- **class-variance-authority**: Component variant management
- **Lucide React**: Icon library

### Build & Development
- **Vite**: Frontend build tool and dev server
- **esbuild**: Server bundling for production
- **TypeScript**: Type checking across the codebase

### Form & Validation
- **React Hook Form**: Form state management
- **Zod**: Schema validation (with drizzle-zod integration)