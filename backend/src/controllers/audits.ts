import { AuthRequest } from '../types/index';
import { Response } from 'express';
import pool from '../database/db';

// GET /api/audits - List all audits (with role-based filtering)
export async function getAudits(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    let query = 'SELECT * FROM audits WHERE 1=1';
    const params: any[] = [];

    // Role-based filtering
    if (req.user.role === 'L1_Auditor') {
      query += ' AND l1_auditor_id = $1';
      params.push(req.user.user_id);
    } else if (req.user.role === 'L2_Auditor') {
      query += ' AND l2_auditor_id = $1';
      params.push(req.user.user_id);
    } else if (req.user.role === 'Process_Owner') {
      query += ' AND process_owner_id = $1';
      params.push(req.user.user_id);
    }
    // Admin sees all

    query += ' ORDER BY audit_date DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch audits' });
  }
}

// GET /api/audits/:id - Get specific audit with all related data
export async function getAuditById(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    // Fetch audit
    const auditRes = await pool.query('SELECT * FROM audits WHERE audit_id = $1', [id]);
    if (auditRes.rows.length === 0) {
      res.status(404).json({ error: 'Audit not found' });
      return;
    }

    const audit = auditRes.rows[0];

    // Check access control
    if (req.user?.role === 'L1_Auditor' && audit.l1_auditor_id !== req.user.user_id) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }
    if (req.user?.role === 'L2_Auditor' && audit.l2_auditor_id !== req.user.user_id) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }
    if (req.user?.role === 'Process_Owner' && audit.process_owner_id !== req.user.user_id) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Fetch template sections and questions
    const templateRes = await pool.query(
      `SELECT ts.*, tq.* FROM template_sections ts
       LEFT JOIN template_questions tq ON ts.section_id = tq.section_id
       WHERE ts.template_id = $1
       ORDER BY ts.section_order, tq.question_order`,
      [audit.template_id]
    );

    // Fetch all data capture tables
    // MODIFIED: Join with questions/sections to get text & input_type
    const checklistRes = await pool.query(
      `SELECT 
        aca.*, 
        tq.question_text, 
        tq.input_type, 
        tq.question_order,
        ts.section_name,
        ts.section_order
       FROM audit_checklist_answers aca
       JOIN template_questions tq ON aca.question_id = tq.question_id
       JOIN template_sections ts ON tq.section_id = ts.section_id
       WHERE aca.audit_id = $1
       ORDER BY ts.section_order, tq.question_order`,
      [id]
    );
    const objectivesRes = await pool.query(
      'SELECT * FROM audit_objectives_log WHERE audit_id = $1',
      [id]
    );
    const calibrationRes = await pool.query(
      'SELECT * FROM audit_calibration_log WHERE audit_id = $1',
      [id]
    );
    const parametersRes = await pool.query(
      'SELECT * FROM audit_parameter_log WHERE audit_id = $1',
      [id]
    );
    const ncsRes = await pool.query(
      'SELECT * FROM non_conformances WHERE audit_id = $1',
      [id]
    );

    res.json({
      audit,
      template: templateRes.rows,
      checklist: checklistRes.rows,
      objectives: objectivesRes.rows,
      calibration: calibrationRes.rows,
      parameters: parametersRes.rows,
      nonconformances: ncsRes.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch audit details' });
  }
}

// POST /api/audits - Create new audit (Admin only)
export async function createAudit(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (req.user?.role !== 'Admin') {
      res.status(403).json({ error: 'Only Admin can create audits' });
      return;
    }

    const {
      template_id,
      machine_name,
      audit_date,
      shift,
      l1_auditor_id,
      l2_auditor_id,
      process_owner_id,
    } = req.body;

    if (!template_id || !machine_name || !l1_auditor_id || !l2_auditor_id || !process_owner_id) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO audits (template_id, machine_name, audit_date, shift, l1_auditor_id, l2_auditor_id, process_owner_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'Assigned')
       RETURNING *`,
      [template_id, machine_name, audit_date || new Date(), shift || 'A', l1_auditor_id, l2_auditor_id, process_owner_id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create audit' });
  }
}

// PUT /api/audits/:id/status - Update audit status
export async function updateAuditStatus(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      res.status(400).json({ error: 'Status is required' });
      return;
    }

    const validStatuses = [
      'Assigned',
      'NC_Open',
      'NC_Pending_Verify',
      'Submitted_to_L2',
      'Completed',
      'Rejected',
    ];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ error: 'Invalid status' });
      return;
    }

    // Get audit to verify access
    const auditRes = await pool.query('SELECT * FROM audits WHERE audit_id = $1', [id]);
    if (auditRes.rows.length === 0) {
      res.status(404).json({ error: 'Audit not found' });
      return;
    }

    // Create audit log entry
    await pool.query(
      `INSERT INTO audit_logs (audit_id, action, actor_id, details)
       VALUES ($1, $2, $3, $4)`,
      [id, `Status changed to ${status}`, req.user?.user_id, JSON.stringify({ old_status: auditRes.rows[0].status, new_status: status })]
    );

    const result = await pool.query(
      `UPDATE audits SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE audit_id = $2 RETURNING *`,
      [status, id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update audit status' });
  }
}

// PUT /api/audits/:id/submit - L1 submits audit to L2
export async function submitAuditToL2(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    // Verify this is the assigned L1
    const auditRes = await pool.query('SELECT * FROM audits WHERE audit_id = $1', [id]);
    if (auditRes.rows.length === 0) {
      res.status(404).json({ error: 'Audit not found' });
      return;
    }

    if (auditRes.rows[0].l1_auditor_id !== req.user?.user_id) {
      res.status(403).json({ error: 'Only assigned L1 can submit' });
      return;
    }

    // Check if any NCs exist
    const ncsRes = await pool.query(
      "SELECT COUNT(*) FROM non_conformances WHERE audit_id = $1 AND status = 'Open'",
      [id]
    );

    const newStatus = ncsRes.rows[0].count > 0 ? 'NC_Pending_Verify' : 'Submitted_to_L2';

    // Create audit log
    await pool.query(
      `INSERT INTO audit_logs (audit_id, action, actor_id, details)
       VALUES ($1, $2, $3, $4)`,
      [id, 'Submitted to L2', req.user?.user_id, JSON.stringify({ has_ncs: ncsRes.rows[0].count > 0 })]
    );

    const result = await pool.query(
      `UPDATE audits SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE audit_id = $2 RETURNING *`,
      [newStatus, id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to submit audit' });
  }
}
