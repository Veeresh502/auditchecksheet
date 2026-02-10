# Digitization of Audit Checksheets (DDAMS)

**DANA Digital Audit Management System** is a modern, web-based solution designed to digitize and streamline the quality audit lifecycle. It replaces traditional paper-based methods with a secure, real-time, and eco-friendly digital platform.

## 🚀 Key Features

*   **Role-Based Access Control (RBAC)**: Secure access for Admins, L1/L2 Auditors, and Process Owners.
*   **Digital Audit Execution**: Interactive checksheets with real-time validation, evidence image uploads, and digital signatures.
*   **Automated Scheduling**: Admins can schedule audits for specific production lines, products, and auditors.
*   **Instant Analytics**: Automated scoring logic calculates audit performance immediately upon submission.
*   **Non-Conformance (NC) Management**: Dedicated workflow for tracking, reviewing, and closing non-conformances.
*   **Auditor Dashboard**: Personalized "My Tasks" view for auditors to manage their assigned schedules.

## 🛠️ Tech Stack

*   **Frontend**: React.js (Vite), TypeScript, Tailwind CSS / Bootstrap
*   **Backend**: Node.js, Express.js, TypeScript
*   **Database**: PostgreSQL
*   **Containerization**: Docker (for Database and pgAdmin)

## 📋 Prerequisites

*   **Node.js** (v18 or higher)
*   **npm** (v9 or higher)
*   **Docker & Docker Compose** (for running the database)

## ⚡ Installation & Setup

### 1. Database Setup (Docker)
The easiest way to set up the database is using Docker Compose.

```bash
# Start PostgreSQL and pgAdmin containers
docker-compose up -d
```

*   **PostgreSQL Port**: `5434` (mapped to container 5432)
*   **Database Name**: `ddams_db`
*   **User**: `ddams_user`
*   **Password**: `ddams_password`
*   **pgAdmin URL**: `http://localhost:5051` (Email: `admin@ddams.com`, Password: `admin`)

### 2. Application Setup
This repository uses npm workspaces for the frontend and backend.

```bash
# Install dependencies for root, frontend, and backend
npm run install-all
```

### 3. Running the Application
You can run both the frontend and backend concurrently from the root directory.

```bash
# Start both Frontend and Backend in development mode
npm run dev
```

Alternatively, you can run them in separate terminals:

**Backend:**
```bash
npm run dev:backend
```
*   Server runs on: `http://localhost:5000` (default)

**Frontend:**
```bash
npm run dev:frontend
```
*   Client runs on: `http://localhost:5173` (default)

## 📖 Usage Guide

### 1. Admin
*   **Login**: Access the system with Admin credentials.
*   **Dashboard**: View global audit stats (Completed, Pending, NCs).
*   **Actions**:
    *   **Manage Users**: Create/Edit users and assign roles.
    *   **Schedule Audits**: Create new audit schedules.
    *   **Manage Products/Lines**: Update master data.

### 2. Auditor (L1/L2)
*   **My Tasks**: View assigned audits for the day/week.
*   **Conduct Audit**: Fill out checksheets, take photos of defects, and sign off.
*   **History**: View past completed audits.

### 3. Process Owner
*   **NC Review**: Monitor raised Non-Conformances.
*   **Action Plan**: Provide corrective actions and close NCs once resolved.

## 🤝 Contributing
1.  Fork the repository.
2.  Create a feature branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.

---
**License**: MIT
