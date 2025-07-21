# Life Companion App - Replit Migration

## Overview
A comprehensive life tracking and goal management application with AI companion integration. Successfully migrated from Lovable to Replit environment on July 21, 2025.

## Project Architecture
- **Frontend**: React with Vite, using wouter for routing (Replit-optimized)
- **Backend**: Express.js server with TypeScript
- **Styling**: Tailwind CSS with shadcn/ui components
- **State Management**: TanStack Query for data fetching
- **Database**: Currently using in-memory storage (MemStorage), prepared for PostgreSQL migration

## Key Features
- Life metrics dashboard with circular progress indicators
- Onboarding flow for new users
- Responsive design (mobile and desktop)
- AI companion chat integration (GPT modal)
- Goal tracking and insights
- Community features
- User profiles

## Recent Changes

### Migration (July 21, 2025)
- ✓ Fixed missing dependencies (react-router-dom, sonner)
- ✓ Updated routing from react-router-dom to wouter for Replit compatibility
- ✓ Fixed server configuration and imports
- ✓ UI fix: Adjusted "Chat with your Companion" module height to match "Your life Overview" module

### Planned Enhancements
- Custom GPT integration with webhook endpoints
- AI processing pipelines for chat analysis
- Context sharing between app and Custom GPT
- Database schema for chat storage and user insights

## User Preferences
- Prefers to build Custom GPT externally before setting up database
- Wants AI pipelines for conversation analysis and insight generation
- Focus on building backend infrastructure in Replit for GPT integration

## Technical Notes
- Server runs on port 5000 (required for Replit)
- Uses wouter instead of react-router-dom for better Replit compatibility
- Vite configuration handled automatically by Replit environment
- Ready for AI pipeline development using Node.js libraries