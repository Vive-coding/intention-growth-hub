# Life Companion App - Intention Growth Hub

## Overview
A comprehensive life tracking and goal management application with AI companion integration. Successfully migrated from Lovable to Replit environment and now implementing Phase 1 database integration with authentication.

## Project Architecture
- **Frontend**: React with Vite, using wouter for routing (Replit-optimized)
- **Backend**: Express.js server with TypeScript
- **Authentication**: Replit Auth (OpenID Connect) with session management
- **Database**: PostgreSQL with Drizzle ORM (UUID-based schema)
- **Styling**: Tailwind CSS with shadcn/ui components
- **State Management**: TanStack Query for data fetching

## Key Features
- **Authentication**: Landing page → Login/Logout via Replit Auth
- **Life Metrics Dashboard**: 6 areas with circular progress indicators (height-matched modules)
- **Database Schema**: Users, life metrics, goals with proper relations
- **Onboarding flow**: Preserved existing flow, ready for database integration
- **Responsive design**: Mobile and desktop optimized
- **AI companion chat integration**: GPT modal (ready for Custom GPT)

## Recent Changes

### Migration (July 21, 2025)
- ✓ Fixed missing dependencies (react-router-dom, sonner)
- ✓ Updated routing from react-router-dom to wouter for Replit compatibility
- ✓ Fixed server configuration and imports
- ✓ UI fix: Adjusted "Chat with your Companion" module height to match "Your life Overview" module

### Phase 1 Database Integration (July 28, 2025)
- ✓ Implemented PostgreSQL database with UUID-based schema
- ✓ Created comprehensive schema: users, life_metric_definitions, goal_definitions, goal_instances
- ✓ Integrated Replit Auth (OpenID Connect) with proper session management
- ✓ Fixed authentication flow with credentials support for cookie-based auth
- ✓ Created landing page for unauthenticated users with feature highlights
- ✓ Updated App routing to handle authenticated vs unauthenticated states
- ✓ Built DatabaseStorage class with full CRUD operations
- ✓ Added API endpoints for life metrics and goals management
- ✓ Connected ProfileScreen to real user data from database
- ✓ Created rich test dataset with 6 users (2 real + 4 test users) with complete life metrics and goals

### Phase 2: Dashboard Data Integration ✓ COMPLETED
**Accomplished:**
- ✓ Connected Life Metrics Dashboard to real database data
- ✓ Created progress calculation logic with actual user goal percentages
- ✓ Replaced hardcoded values with authentic database-driven metrics
- ✓ Added proper loading and error states for better UX
- ✓ Successfully displaying real user progress data

### Phase 3: Goal Management & Progress Updates (Current)
**Objectives:**
- Enable users to update goal progress from the UI
- Create goal completion workflows
- Add goal creation and editing functionality
- Implement goal status management (active, completed, paused)
- Build interactive goal tracking with real-time updates

### Future Phases
- Phase 3: Custom GPT integration with webhook endpoints
- Phase 4: AI processing pipelines for chat analysis using vectorization approach
- Phase 5: Context sharing between app and Custom GPT

## User Preferences
- Step-by-step implementation approach with testing at each phase
- Prefers to build Custom GPT externally before setting up database
- Wants comprehensive AI pipelines with vectorization for:
  - Real-time chat analysis for insights
  - Goal progress tracking from conversations
  - Habit pattern recognition
  - Bidirectional API communication with Custom GPT
- Focus on building backend infrastructure in Replit for GPT integration

## Technical Notes
- Server runs on port 5000 (required for Replit)
- Uses wouter instead of react-router-dom for better Replit compatibility
- Vite configuration handled automatically by Replit environment
- Database schema follows UUID patterns from project specification
- Ready for AI pipeline development using Node.js libraries (OpenAI API, Pinecone, etc.)