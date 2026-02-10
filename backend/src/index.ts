import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { errorHandler } from './middleware/errorHandler';
import { runMigrations } from './database/migrate';
import authRoutes from './routes/auth';
import usersRoutes from './routes/users';
import auditRoutes from './routes/audits';
import dataCaptureRoutes from './routes/data-capture';
import ncRoutes from './routes/ncs';
import scoringRoutes from './routes/scoring';
import templateRoutes from './routes/templates';
import analyticsRoutes from './routes/analytics';
import l1Routes from './routes/l1';
import { initScheduler } from './services/schedulerService';

import uploadRoutes from './routes/upload';
import dockRoutes from './routes/dock';
import mfgRoutes from './routes/mfg-audit';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
//app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(
  cors({
    origin: true,
    credentials: true
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ============================================================================
// HEALTH CHECK & INFO
// ============================================================================

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api', (req, res) => {
  res.json({
    message: 'Dana API v1.0.0',
    status: 'running',
    endpoints: {
      auth: ['/api/auth/register', '/api/auth/login', '/api/auth/me'],
      audits: ['/api/audits', '/api/audits/:id', '/api/audits/:id/status', '/api/audits/:id/submit'],
      dataCapture: ['/api/audits/:id/checklist-answer', '/api/audits/:id/objectives', '/api/audits/:id/calibration', '/api/audits/:id/parameters', '/api/audits/:id/progress'],
      ncs: ['/api/ncs/open', '/api/audits/:id/ncs', '/api/ncs/:id/resolve', '/api/ncs/:id/verify', '/api/ncs/:id (DELETE)'],
      scoring: ['/api/audits/:id/score', '/api/audits/:id/compliance-score', '/api/audits/:id/approve', '/api/audits/:id/reject'],
      templates: ['/api/templates', '/api/templates/:id', '/api/templates (POST)', '/api/templates/:id/sections', '/api/templates/:id/sections/:secId/questions']
    }
  });
});

// ============================================================================
// API ROUTES
// ============================================================================

// Authentication (register, login, profile)
app.use('/api/auth', authRoutes);

// User Management (Admin only)
app.use('/api/users', usersRoutes);

// Audit Management (CRUD, status updates)
app.use('/api/audits', auditRoutes);

// Data Capture (answers, objectives, calibrations, parameters)
app.use('/api/answers', dataCaptureRoutes);

// Non-Conformances (workflow: Open → Pending_Verification → Closed)
app.use('/api/nc', ncRoutes);

// L2 Scoring & Approval (scoring, statistics, approval, rejection)
app.use('/api/audits', scoringRoutes);

// Templates Management (CRUD for audit templates - Admin only)
app.use('/api/templates', templateRoutes);

// Analytics & Reporting
app.use('/api/analytics', analyticsRoutes);

app.use('/api/l1', l1Routes);

app.use('/api/upload', uploadRoutes);

// Dock Audit Plan
app.use('/api/dock-plan', dockRoutes);

// Manufacturing Audit Plan
app.use('/api/mfg-plan', mfgRoutes);



// ============================================================================
// ERROR HANDLER (MUST BE LAST)
// ============================================================================

app.use(errorHandler);

// ============================================================================
// INITIALIZE DATABASE & START SERVER
// ============================================================================

async function startServer() {
  try {
    console.log('🔄 Initializing database...');
    await runMigrations();
    console.log('✅ Database initialized');

    // Start background jobs
    initScheduler();

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📚 API available at http://localhost:${PORT}/api`);
      console.log(`💚 Health check at http://localhost:${PORT}/health`);
      console.log('');
      console.log('📋 ROUTE SUMMARY:');
      console.log('   🔐 Auth:        POST /api/auth/login, /register | GET /me');
      console.log('   📊 Audits:      GET /api/audits, /audits/:id');
      console.log('   📝 Data:        POST /api/audits/:id/answers|objectives|calibrations|parameters');
      console.log('   ⚠️  NCs:         POST /api/ncs (L1) | PUT /api/ncs/:id (Owner) | PUT /verify (L1)');
      console.log('   🎯 Scoring:     PUT /api/audits/:id/score (L2) | PUT /approve (L2)');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;
