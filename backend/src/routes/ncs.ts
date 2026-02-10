import { Router, Response } from 'express';
import pool from '../database/db';
import { AuthRequest } from '../types/index';
import { authenticateToken, authorizeRole } from '../middleware/auth';
import { sendNotification } from '../services/emailService';

const router = Router();

// ============================================================================
// NON-CONFORMANCE ENDPOINTS
// ============================================================================

// GET /api/nc/my-tasks - Get NCs assigned to Process Owner
router.get('/my-tasks', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'Process_Owner' && req.user?.role !== 'Admin') {
      res.status(403).json({ error: 'Only Process Owners can access this' });
      return;
    }

    const { view } = req.query;
    let statusFilter = "('Open', 'Pending_Verification')"; // Default Active

    if (view === 'history') {
      statusFilter = "('Closed')";
    }

    const result = await pool.query(
      `SELECT nc.*, a.machine_name, a.audit_date, a.shift
       FROM non_conformances nc
       JOIN audits a ON nc.audit_id = a.audit_id
       WHERE a.process_owner_id = $1 AND nc.status IN ${statusFilter}
       ORDER BY nc.created_at DESC`,
      [req.user.user_id]
    );

    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/ncs/admin/all - Get all NCs for Admin history
router.get('/admin/all', authenticateToken, authorizeRole('Admin'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT nc.*, 
              a.machine_name, a.audit_date, a.shift,
              q.question_text,
              u1.full_name as auditor_name,
              u2.full_name as owner_name,
              u3.full_name as l1_verifier_name
       FROM non_conformances nc
       JOIN audits a ON nc.audit_id = a.audit_id
       LEFT JOIN template_questions q ON nc.question_id::text = q.question_id::text
       LEFT JOIN users u1 ON a.l1_auditor_id = u1.user_id
       LEFT JOIN users u2 ON a.process_owner_id = u2.user_id
       LEFT JOIN users u3 ON nc.l1_verifier_id = u3.user_id
       ORDER BY nc.created_at DESC`
    );

    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/ncs/:id - Get specific NC
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT nc.*, 
              a.machine_name, a.audit_date, a.shift,
              q.question_text,
              u1.full_name as created_by_name,
              u2.full_name as l1_verifier_name
       FROM non_conformances nc
       JOIN audits a ON nc.audit_id = a.audit_id
       LEFT JOIN template_questions q ON nc.question_id::text = q.question_id::text
       LEFT JOIN users u1 ON a.l1_auditor_id = u1.user_id
       LEFT JOIN users u2 ON nc.l1_verifier_id = u2.user_id
       WHERE nc.nc_id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'NC not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ncs - Create new NC
router.post('/', authenticateToken, authorizeRole('L1_Auditor', 'Admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { audit_id, question_id, issue_description, issue_image_url } = req.body;

    const result = await pool.query(
      `INSERT INTO non_conformances (audit_id, question_id, issue_description, issue_image_url, status)
       VALUES ($1, $2, $3, $4, 'Open')
       RETURNING *`,
      [audit_id, question_id, issue_description, issue_image_url]
    );

    // Update audit status
    await pool.query(
      `UPDATE audits SET status = 'NC_Open' WHERE audit_id = $1`,
      [audit_id]
    );

    // --- NEW: Email Process Owner ---
    const ownerRes = await pool.query(
      `SELECT u.email, u.full_name, a.machine_name 
       FROM audits a 
       JOIN users u ON a.process_owner_id = u.user_id 
       WHERE a.audit_id = $1`,
      [audit_id]
    );

    if (ownerRes.rows.length > 0) {
      const { email, full_name, machine_name } = ownerRes.rows[0];
      await sendNotification(
        email,
        `Action Required: New NC Raised on ${machine_name}`,
        `Hello ${full_name},\n\nA New Non-Conformance (NC) has been raised for ${machine_name}.\nIssue: "${issue_description}"\n\nPlease log in to your dashboard to provide a root cause and corrective action.\n\n- DANA Audit System`
      );
    }
    // ----------------------------

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/nc/:id/resolve - Process Owner resolves NC
router.post('/:id/resolve', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'Process_Owner' && req.user?.role !== 'Admin') {
      res.status(403).json({ error: 'Only Process Owners can resolve NCs' });
      return;
    }

    const { id } = req.params;
    const { root_cause, corrective_action, evidence_url } = req.body;

    if (!root_cause || !corrective_action) {
      res.status(400).json({ error: 'Root cause and corrective action are required' });
      return;
    }

    const result = await pool.query(
      `UPDATE non_conformances 
       SET root_cause = $1, corrective_action = $2, evidence_url = $3, status = 'Pending_Verification'
       WHERE nc_id = $4
       RETURNING *`,
      [root_cause, corrective_action, evidence_url, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'NC not found' });
      return;
    }

    // Fetch L1 Auditor Email (Reverted to L1 per request)
    const auditRes = await pool.query(
      `SELECT u.email, u.full_name, a.machine_name 
       FROM non_conformances nc
       JOIN audits a ON nc.audit_id = a.audit_id
       JOIN users u ON a.l1_auditor_id = u.user_id -- Target L1
       WHERE nc.nc_id = $1`,
      [id]
    );

    // Send Email
    if (auditRes.rows.length > 0) {
      const { email, full_name, machine_name } = auditRes.rows[0];
      await sendNotification(
        email,
        `Verification Needed (L1): NC Resolved on ${machine_name}`,
        `Hello ${full_name},\n\nThe Process Owner has submitted a corrective action for ${machine_name}.\n\nPlease log in to your dashboard to Verify and Close this NC.\n\n- DANA Audit System`
      );
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/nc/:id/verify - L1 closes NC
router.post('/:id/verify', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'L1_Auditor' && req.user?.role !== 'Admin') {
      res.status(403).json({ error: 'Only L1 auditors can verify NCs' });
      return;
    }

    const { id } = req.params;

    // 1. Mark NC as Closed
    const result = await pool.query(
      `UPDATE non_conformances 
       SET status = 'Closed', l1_verifier_id = $1, verified_at = NOW()
       WHERE nc_id = $2
       RETURNING audit_id, status`, // <--- Return audit_id to check remaining NCs
      [req.user.user_id, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'NC not found' });
      return;
    }

    const auditId = result.rows[0].audit_id;

    // 2. CHECK: Are there any other Open/Pending NCs for this audit?
    const checkRemaining = await pool.query(
      `SELECT COUNT(*) as count FROM non_conformances 
       WHERE audit_id = $1 AND status != 'Closed'`,
      [auditId]
    );

    const remainingNCs = parseInt(checkRemaining.rows[0].count);

    // 3. LOGIC: If 0 NCs remain, unlock the audit (Set status back to 'Assigned')
    if (remainingNCs === 0) {
      await pool.query(
        `UPDATE audits SET status = 'Assigned', updated_at = NOW() WHERE audit_id = $1`,
        [auditId]
      );
    }

    res.json({
      message: 'NC verified',
      audit_unlocked: remainingNCs === 0
    });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;