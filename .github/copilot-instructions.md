# DANA Digital Audit Management System (DDAMS) - Copilot Instructions

## Project Overview
DDAMS is a PERN stack (PostgreSQL, Express, React, Node.js) application designed to digitize the end-to-end audit lifecycle with role-based workflows and separation of duties.

### Core Philosophy
- L1 Auditor: Collects Facts (Data/Evidence)
- Process Owner: Fixes Faults (NCs/Corrective Actions)
- L2 Auditor: Assigns Score (Judgment)
- Admin: Master Data Management

### User Roles & Workflows
1. **Level 1 Auditor**: Data collection, NC trigger, verification
2. **Process Owner**: Corrective action (CAPA) response
3. **Level 2 Auditor**: Scoring and final approval
4. **Admin**: User creation, audit scheduling, checklist management

## Project Structure
- `/backend` - Express.js REST API
- `/frontend` - React + Vite SPA
- `/database` - PostgreSQL schemas and migrations
- Docker compose for local development

## Development Setup Progress
- [x] Project folder structure created
- [x] Backend initialization (Express, PostgreSQL connection)
- [x] Frontend initialization (React + Vite)
- [x] Database schema setup
- [x] Docker configuration
- [x] Development tools (ESLint, Prettier, TypeScript)

## Next Steps
1. Set up environment variables (.env files)
2. Start Docker containers
3. Run database migrations
4. Implement API endpoints and controllers
5. Build role-specific UI components
6. Add authentication and authorization
7. Implement state machine workflow logic

