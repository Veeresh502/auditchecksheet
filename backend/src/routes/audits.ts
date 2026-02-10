import { Router, Response } from 'express';
import pool from '../database/db';
import { AuthRequest } from '../types/index';
import { authenticateToken, authorizeRole } from '../middleware/auth';
import { sendNotification } from '../services/emailService';

const router = Router();

// ============================================================================
// AUDIT ENDPOINTS
// ============================================================================

// GET /api/audits - List audits (role-based filtering)
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    let query = `
      SELECT a.audit_id, a.template_id, a.machine_name, a.audit_date, a.shift,
             a.l1_auditor_id, a.l2_auditor_id, a.process_owner_id, a.status,
             a.operation, a.part_name, a.part_number, a.process,
             a.created_at, a.updated_at,
             u1.full_name as l1_auditor_name,
             u2.full_name as l2_auditor_name,
             u3.full_name as process_owner_name
      FROM audits a
      LEFT JOIN users u1 ON a.l1_auditor_id = u1.user_id
      LEFT JOIN users u2 ON a.l2_auditor_id = u2.user_id
      LEFT JOIN users u3 ON a.process_owner_id = u3.user_id
      WHERE 1=1
    `;

    // Role-based filtering
    if (req.user.role === 'L1_Auditor') {
      query += ` AND a.l1_auditor_id = $1`;
    } else if (req.user.role === 'L2_Auditor') {
      query += ` AND a.l2_auditor_id = $1`;
    } else if (req.user.role === 'Process_Owner') {
      query += ` AND a.process_owner_id = $1`;
    }

    query += ` ORDER BY a.audit_date DESC`;

    const result = await pool.query(
      query,
      req.user.role === 'Admin' ? [] : [req.user.user_id]
    );

    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/audits/l1/my-tasks - Get audits assigned to L1 auditor
router.get('/l1/my-tasks', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'L1_Auditor' && req.user?.role !== 'Admin') {
      res.status(403).json({ error: 'Only L1 auditors can access this' });
      return;
    }

    const { view } = req.query;
    let statusFilter = "('Assigned', 'In_Progress', 'NC_Open', 'NC_Pending_Verify', 'Rejected')"; // Default Active

    // History View: Items L1 has worked on that are now moved forward
    if (view === 'history') {
      statusFilter = "('Submitted_to_L2', 'Completed')";
    }

    const result = await pool.query(
      `SELECT a.*, t.template_name
       FROM audits a
       JOIN audit_templates t ON a.template_id = t.template_id
       WHERE a.l1_auditor_id = $1 AND a.status IN ${statusFilter}
       ORDER BY a.audit_date DESC`,
      [req.user.user_id]
    );

    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/audits/l2/inbox - Get audits waiting for L2 review
router.get('/l2/inbox', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'L2_Auditor' && req.user?.role !== 'Admin') {
      res.status(403).json({ error: 'Only L2 auditors can access this' });
      return;
    }

    const { view } = req.query;
    let statusFilter = "('Submitted_to_L2')"; // Default Active

    if (view === 'history') {
      statusFilter = "('Completed')";
    }

    const result = await pool.query(
      `SELECT a.*, t.template_name,
              u1.full_name as l1_auditor_name,
              u3.full_name as process_owner_name
       FROM audits a
       JOIN audit_templates t ON a.template_id = t.template_id
       LEFT JOIN users u1 ON a.l1_auditor_id = u1.user_id
       LEFT JOIN users u3 ON a.process_owner_id = u3.user_id
       WHERE a.l2_auditor_id = $1 AND a.status IN ${statusFilter}
       ORDER BY a.audit_date DESC`,
      [req.user.user_id]
    );

    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/audits/admin/all - Get all audits for admin
router.get('/admin/all', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'Admin') {
      res.status(403).json({ error: 'Only admins can access this' });
      return;
    }

    const result = await pool.query(
      `SELECT a.*, COUNT(DISTINCT nc.nc_id) as open_ncs,
              t.template_name,
              u1.full_name as l1_auditor_name,
              u2.full_name as l2_auditor_name,
              u3.full_name as process_owner_name
       FROM audits a
       LEFT JOIN non_conformances nc ON a.audit_id = nc.audit_id AND nc.status != 'Closed'
       LEFT JOIN audit_templates t ON a.template_id = t.template_id
       LEFT JOIN users u1 ON a.l1_auditor_id = u1.user_id
       LEFT JOIN users u2 ON a.l2_auditor_id = u2.user_id
       LEFT JOIN users u3 ON a.process_owner_id = u3.user_id
       GROUP BY a.audit_id, t.template_name, u1.user_id, u2.user_id, u3.user_id
       ORDER BY a.audit_date DESC`
    );

    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/audits/schedule - Create a new audit
router.post('/schedule', authenticateToken, authorizeRole('Admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { machine_name, audit_date, shift, template_id, l1_auditor_id, l2_auditor_id, process_owner_id, operation, part_name, part_number, series, invoice_no, doc_no, qty_audited, process } = req.body;

    // Basic validation (machine_name moved below template fetch)
    if (!audit_date || !shift || !template_id || !l1_auditor_id || !l2_auditor_id || !process_owner_id) {
      res.status(400).json({ error: 'Missing required basic fields' });
      return;
    }

    // Fetch template to check type
    const templateRes = await pool.query(
      `SELECT template_name FROM audit_templates WHERE template_id = $1`,
      [template_id]
    );

    if (templateRes.rows.length === 0) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    const templateName = templateRes.rows[0].template_name;

    // Conditional validation based on template type
    if (templateName === 'Dock Audit') {
      // Dock Audit requires: series, invoice_no, doc_no, qty_audited
      if (!series || !invoice_no || !doc_no || !qty_audited) {
        res.status(400).json({ error: 'Missing required Dock Audit fields: series, invoice_no, doc_no, qty_audited' });
        return;
      }
    } else {
      // Manufacturing audits require: operation, part_name, part_number AND machine_name
      if (!machine_name || !operation || !part_name || !part_number) {
        res.status(400).json({ error: 'Missing required Manufacturing Audit fields: machine_name, operation, part_name, part_number' });
        return;
      }
    }

    const effectiveMachineName = machine_name || (templateName === 'Dock Audit' ? 'DOCK-AREA' : machine_name);

    const result = await pool.query(
      `INSERT INTO audits (template_id, machine_name, audit_date, shift, l1_auditor_id, l2_auditor_id, process_owner_id, operation, part_name, part_number, series, invoice_no, doc_no, qty_audited, process, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'Assigned')
       RETURNING *`,
      [template_id, effectiveMachineName, audit_date, shift, l1_auditor_id, l2_auditor_id, process_owner_id, operation, part_name, part_number, series, invoice_no, doc_no, qty_audited, process]
    );

    // --- NEW: Email L1 Auditor ---
    const l1Res = await pool.query(`SELECT email, full_name FROM users WHERE user_id = $1`, [l1_auditor_id]);
    if (l1Res.rows.length > 0) {
      const { email, full_name } = l1Res.rows[0];
      await sendNotification(
        email,
        `New Audit Assigned: ${effectiveMachineName}`,
        `Hello ${full_name},\n\nYou have been assigned a new audit for ${effectiveMachineName} on ${audit_date} (${shift}).\nPlease log in to the L1 Dashboard to begin.\n\n- DANA Audit System`
      );
    }
    // ----------------------------

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/audits/:id/full - Get full audit with all data (4 tabs)
router.get('/:id/full', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const auditRes = await pool.query(
      `SELECT a.*, 
              u1.full_name as l1_auditor_name, u1.email as l1_email,
              u2.full_name as l2_auditor_name, u2.email as l2_email,
              u3.full_name as process_owner_name, u3.email as process_owner_email,
              t.template_name
       FROM audits a
       LEFT JOIN users u1 ON a.l1_auditor_id = u1.user_id
       LEFT JOIN users u2 ON a.l2_auditor_id = u2.user_id
       LEFT JOIN users u3 ON a.process_owner_id = u3.user_id
       JOIN audit_templates t ON a.template_id = t.template_id
       WHERE a.audit_id = $1`,
      [id]
    );

    if (auditRes.rows.length === 0) {
      res.status(404).json({ error: 'Audit not found' });
      return;
    }

    const audit = auditRes.rows[0];

    // Fetch last rejection reason if any
    const rejectRes = await pool.query(
      `SELECT details->>'reason' as reason 
       FROM audit_logs 
       WHERE audit_id = $1 AND action = 'Rejected_by_L2' 
       ORDER BY created_at DESC LIMIT 1`,
      [id]
    );
    const rejectionReason = rejectRes.rows[0]?.reason || null;

    // Fetch all data capture tables
    const [answers, objectives, calibrations, parameters, ncs] = await Promise.all([
      pool.query(
        `SELECT 
           q.question_id, 
           q.question_text, 
           ts.section_name, 
           ts.section_order,
           aca.l1_observation, 
           aca.file_url,
           aca.l2_score,
           aca.l2_remarks
         FROM template_questions q
         JOIN template_sections ts ON q.section_id = ts.section_id
         JOIN audits a ON a.template_id = ts.template_id
         LEFT JOIN audit_checklist_answers aca 
           ON q.question_id = aca.question_id AND aca.audit_id = a.audit_id
         WHERE a.audit_id = $1
         ORDER BY ts.section_order, q.question_order`,
        [id]
      ),
      pool.query(
        `SELECT * FROM audit_objectives_log WHERE audit_id = $1`,
        [id]
      ),
      pool.query(
        `SELECT * FROM audit_calibration_log WHERE audit_id = $1`,
        [id]
      ),
      pool.query(
        `SELECT * FROM audit_parameter_log WHERE audit_id = $1`,
        [id]
      ),
      pool.query(
        `SELECT * FROM non_conformances WHERE audit_id = $1`,
        [id]
      )
    ]);

    res.json({
      audit,
      data: {
        checklist: answers.rows,
        objectives: objectives.rows,
        calibrations: calibrations.rows,
        parameters: parameters.rows,
        ncs: ncs.rows
      },
      rejection_reason: rejectionReason
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/audits/:id - Get specific audit
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT a.*, t.template_name
       FROM audits a
       JOIN audit_templates t ON a.template_id = t.template_id
       WHERE a.audit_id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Audit not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});



// PUT /api/audits/:id/status - Update audit status
router.put('/:id/status', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const result = await pool.query(
      `UPDATE audits SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE audit_id = $2 RETURNING *`,
      [status, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Audit not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/audits/:id/submit-l2 - Submit audit to L2
router.post('/:id/submit-l2', authenticateToken, authorizeRole('L1_Auditor', 'Admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // 2. CHECK: Are there any Open NCs?
    const ncRes = await pool.query(
      `SELECT COUNT(*) FROM non_conformances 
       WHERE audit_id = $1 AND status != 'Closed'`,
      [id]
    );

    if (parseInt(ncRes.rows[0].count) > 0) {
      res.status(400).json({
        error: 'Cannot submit audit: There are unclosed Non-Conformances. Please verify and close all NCs first.'
      });
      return;
    }

    // 3. Update Status to 'Submitted_to_L2'
    const result = await pool.query(
      `UPDATE audits 
       SET status = 'Submitted_to_L2', submitted_at = NOW(), updated_at = NOW() 
       WHERE audit_id = $1 
       RETURNING *`,
      [id]
    );

    // --- NEW: Email L2 Auditor ---
    const l2Res = await pool.query(
      `SELECT u.email, u.full_name, a.machine_name 
       FROM audits a 
       JOIN users u ON a.l2_auditor_id = u.user_id 
       WHERE a.audit_id = $1`,
      [id]
    );

    if (l2Res.rows.length > 0) {
      const { email, full_name, machine_name } = l2Res.rows[0];
      await sendNotification(
        email,
        `Action Required: Audit Submitted for ${machine_name}`,
        `Hello ${full_name},\n\nThe L1 Auditor has submitted the audit for ${machine_name}.\nPlease log in to your dashboard to Review and Score this audit.\n\n- DANA Audit System`
      );
    }
    // ----------------------------

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/audits/:id/signature - Update signature URL
router.patch('/:id/signature', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { signature_type, file_url } = req.body; // 'l1' or 'l2'

    if (!['l1', 'l2'].includes(signature_type) || !file_url) {
      res.status(400).json({ error: 'Invalid signature type or missing file URL' });
      return;
    }

    const column = signature_type === 'l1' ? 'l1_signature_url' : 'l2_signature_url';

    const result = await pool.query(
      `UPDATE audits SET ${column} = $1, updated_at = NOW() WHERE audit_id = $2 RETURNING *`,
      [file_url, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Audit not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/audits/:id/dates - Update audit date (Admin only)
router.patch('/:id/dates', authenticateToken, authorizeRole('Admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { audit_date } = req.body;

    if (!audit_date) {
      res.status(400).json({ error: 'Audit date is required' });
      return;
    }

    const result = await pool.query(
      `UPDATE audits SET audit_date = $1, updated_at = NOW() WHERE audit_id = $2 RETURNING *`,
      [audit_date, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Audit not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/audits/:id - Delete audit and cleanup related data
router.delete('/:id', authenticateToken, authorizeRole('Admin'), async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    await client.query('BEGIN');

    // 1. Delete dependent data
    await client.query(`DELETE FROM audit_checklist_answers WHERE audit_id = $1`, [id]);
    await client.query(`DELETE FROM audit_objectives_log WHERE audit_id = $1`, [id]);
    await client.query(`DELETE FROM audit_calibration_log WHERE audit_id = $1`, [id]);
    await client.query(`DELETE FROM audit_parameter_log WHERE audit_id = $1`, [id]);

    // 1b. Update Dock Audit Plan if this audit was part of it
    const weeks = [1, 2, 3, 4];
    for (const w of weeks) {
      await client.query(
        `UPDATE dock_audit_plan 
             SET week_${w}_plan = false, week_${w}_audit_id = NULL 
             WHERE week_${w}_audit_id = $1`,
        [id]
      );
    }

    // 2. Delete NCs (could have separate documents/photos, but cascading delete here for simplicity)
    await client.query(`DELETE FROM non_conformances WHERE audit_id = $1`, [id]);

    // 3. Update Manufacturing Audit Plan if this audit was part of it
    // We need to find if this audit ID is referenced in any week_X_audit_id column
    for (const w of weeks) {
      await client.query(
        `UPDATE mfg_audit_plan 
             SET week_${w}_plan = false, week_${w}_audit_id = NULL 
             WHERE week_${w}_audit_id = $1`,
        [id]
      );
    }

    // 4. Delete the audit itself
    const result = await client.query(`DELETE FROM audits WHERE audit_id = $1 RETURNING *`, [id]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Audit not found' });
      return;
    }

    await client.query('COMMIT');
    res.json({ message: 'Audit deleted successfully', audit: result.rows[0] });

  } catch (error: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

export default router;