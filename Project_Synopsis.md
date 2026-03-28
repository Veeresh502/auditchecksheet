# Project Synopsis: Digital Audit Checksheet System (DDAMS)

## 1. Executive Summary
The **DANA Digital Audit Management System (DDAMS)** is a modern, web-based quality assurance platform designed to digitize, streamline, and modernize the manufacturing audit lifecycle. By replacing traditional, error-prone paper-based auditing methods with a secure and real-time digital solution, the system ensures higher data integrity, robust tracking of non-conformances (NC), and faster decision-making for quality control.

## 2. Problem Statement
In manufacturing, traditional auditing heavily relies on paper checksheets. This manual process introduces several critical challenges:
*   **Delayed Reporting:** Data transcription from paper to digital systems creates a lag between detecting quality issues and resolving them.
*   **Data Inaccuracy:** Illegible handwriting, lost forms, and manual calculation errors compromise the integrity of audit data.
*   **Poor Traceability:** Physical records are difficult to search, making it challenging to identify long-term quality trends or ensure compliance with standards like ISO.
*   **Environmental Impact:** High reliance on paper contributes to increased waste and a larger carbon footprint.

## 3. Proposed Solution & Objectives
To resolve these inefficiencies, DDAMS introduces a centralized platform tailored for end-to-end audit management. The core objectives include:
*   **Eliminating Paperwork:** Providing an intuitive digital interface for auditors to execute quality checks on the shop floor via tablets or mobile devices.
*   **Real-time Data Capture:** Enabling immediate upload of visual evidence (photos) and real-time logging of audit outcomes.
*   **Automated Analytics:** Instantly calculating audit scores and generating analytical dashboards for management.
*   **Secured Workflows:** Implementing Role-Based Access Control (RBAC) and digital signatures for compliance and accountability.

## 4. Key Features
*   **Role-Based Access Control (RBAC):** Secure and distinct workflows for Admins, L1/L2 Auditors, and Process Owners.
*   **Automated Audit Scheduling:** Admins can easily schedule specific audits targeting particular product lines, dates, and auditors.
*   **Interactive Digital Execution:** Dynamic checksheets featuring real-time validations, evidence image uploads, and digital sign-offs.
*   **Instant Scoring & Dashboards:** Automated logic computes audit performance instantly, while dynamic dashboards provide global metrics (Completed vs. Pending, NC rates).
*   **Non-Conformance (NC) Management:** A dedicated tracking mechanism allowing Process Owners to review, provide action plans, and close flagged non-conformances.

## 5. Technology Stack
The application is built using a modern, scalable, and robust architecture:
*   **Frontend:** React.js (Vite), TypeScript, Tailwind CSS / Bootstrap
*   **Backend:** Node.js, Express.js, TypeScript
*   **Database:** PostgreSQL
*   **Deployment/Containerization:** Docker (with Docker Compose for seamless database initialization)

## 6. Target Audience & Roles
*   **Administrators:** Manage global schedules, master data (Products/Lines), and user permissions. Monitor overall performance metrics.
*   **Auditors (L1 & L2):** Access personalized "My Tasks" queues. Conduct audits, capture photographic evidence of defects, and submit findings on the floor.
*   **Process Owners:** Track non-conformances raised during audits. Submit corrective action plans and formally close resolved issues.

## 7. Expected Impact & Future Scope
The successful deployment of DDAMS yields a reported **30% increase in audit execution speed** while drastically improving data accuracy. 
**Future expansions** include potential AI-driven analytics for predictive quality assurance, a dedicated offline-capable native mobile application, and direct IoT integration with manufacturing machinery to trigger automated audits based on machine events.
