# Overview

This is a full-stack wellness and personal growth application built with React (frontend) and Express.js (backend). The application serves as a companion to an AI chat interface, helping users track their life metrics, set goals, gain insights, and connect with a community. It features a responsive design that works on both mobile and desktop platforms.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

The application follows a monorepo structure with clear separation between client, server, and shared code:

- **Frontend**: React with TypeScript, using Vite as the build tool
- **Backend**: Express.js with TypeScript for API endpoints
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **UI Framework**: shadcn/ui components built on Radix UI primitives with Tailwind CSS
- **State Management**: TanStack Query for server state management
- **Routing**: Wouter for lightweight client-side routing

## Key Components

### Frontend Architecture
- **Component Structure**: Modular React components organized by feature (Dashboard, Goals, Insights, Community, Profile)
- **UI System**: shadcn/ui component library providing consistent design patterns
- **Responsive Design**: Mobile-first approach with dedicated mobile navigation and desktop sidebar
- **State Management**: React hooks and TanStack Query for data fetching and caching

### Backend Architecture
- **API Layer**: Express.js server with RESTful endpoints under `/api` prefix
- **Data Access**: Storage interface abstraction with both in-memory and database implementations
- **Development Setup**: Vite integration for hot module replacement in development
- **Error Handling**: Centralized error handling middleware

### Database Schema
- **Users Table**: Basic user authentication with username/password fields
- **Type Safety**: Drizzle ORM with Zod validation for runtime type checking
- **Migrations**: Database schema versioning through Drizzle Kit

## Data Flow

1. **User Interaction**: Users interact with React components in the frontend
2. **API Calls**: Frontend makes HTTP requests to Express.js backend endpoints
3. **Data Processing**: Backend processes requests and interacts with database through storage interface
4. **Response Handling**: Data flows back through the API to frontend components
5. **State Updates**: TanStack Query manages caching and state synchronization

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL database connectivity for serverless environments
- **@tanstack/react-query**: Server state management and data fetching
- **drizzle-orm**: Type-safe ORM for database operations
- **@radix-ui/***: Headless UI components for accessibility and behavior
- **tailwindcss**: Utility-first CSS framework for styling

### Development Tools
- **Vite**: Fast build tool with hot module replacement
- **TypeScript**: Type safety across the entire application
- **ESBuild**: Fast JavaScript bundler for production builds

## Deployment Strategy

The application is configured for multiple deployment scenarios:

### Development
- **Dev Server**: `npm run dev` starts both frontend and backend with hot reloading
- **Database**: Uses DATABASE_URL environment variable for PostgreSQL connection
- **Vite Integration**: Backend serves Vite dev server with middleware for seamless development

### Production
- **Build Process**: `npm run build` compiles both frontend and backend
- **Static Assets**: Frontend builds to `dist/public` directory
- **Server Bundle**: Backend compiles to `dist/index.js` with ESBuild
- **Environment**: NODE_ENV-based configuration switching

### Database Management
- **Schema Sync**: `npm run db:push` applies schema changes to database
- **Migrations**: Stored in `./migrations` directory with Drizzle Kit
- **Connection**: Supports PostgreSQL through DATABASE_URL environment variable

The architecture prioritizes developer experience with fast development cycles, type safety throughout the stack, and a scalable component-based frontend that can easily adapt to new features and requirements.