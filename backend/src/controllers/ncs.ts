import { AuthRequest } from '../types/index';
import { sendNotification } from '../services/emailService';
import { Response } from 'express';
import pool from '../database/db';

// GET /api/audits/:id/ncs - Get non-conformances for audit
export async function getAuditNCs(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT * FROM non_conformances WHERE audit_id = $1 ORDER BY created_at DESC`,
      [id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch NCs' });
  }
}

// GET /api/ncs/open - Get all open NCs for Process Owner dashboard
export async function getOpenNCs(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (req.user?.role !== 'Process_Owner') {
      res.status(403).json({ error: 'Only Process Owner can view' });
      return;
    }

    const result = await pool.query(
      `SELECT nc.*, a.machine_name, a.audit_date
       FROM non_conformances nc
       JOIN audits a ON nc.audit_id = a.audit_id
       WHERE a.process_owner_id = $1 AND nc.status = 'Open'
       ORDER BY nc.created_at DESC`,
      [req.user.user_id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch open NCs' });
  }
}

// POST /api/audits/:id/ncs - Create new NC (L1 raises)
export async function createNC(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { question_id, issue_description } = req.body;

    // Verify audit exists and user is L1
    const auditRes = await pool.query('SELECT * FROM audits WHERE audit_id = $1', [id]);
    if (auditRes.rows.length === 0) {
      res.status(404).json({ error: 'Audit not found' });
      return;
    }

    if (auditRes.rows[0].l1_auditor_id !== req.user?.user_id) {
      res.status(403).json({ error: 'Only L1 can create NCs' });
      return;
    }

    // --- NEW: Email Process Owner ---
    const poRes = await pool.query(
      `SELECT u.email, u.full_name, a.machine_name 
       FROM audits a 
       JOIN users u ON a.process_owner_id = u.user_id 
       WHERE a.audit_id = $1`,
      [id]
    );

    if (poRes.rows.length > 0) {
      const { email, full_name, machine_name } = poRes.rows[0];
      await sendNotification(
        email,
        `Action Required: New NC for ${machine_name}`,
        `Hello ${full_name},\n\nA new Non-Conformance has been raised for ${machine_name}.\nIssue: ${issue_description}\n\nPlease log in to the Process Owner Dashboard to resolve this.\n\n- DANA Audit System`
      );
    }
    // ----------------------------

    const result = await pool.query(
      `INSERT INTO non_conformances (audit_id, question_id, issue_description, status, nc_date)
       VALUES ($1, $2, $3, 'Open', CURRENT_DATE)
       RETURNING *`,
      [id, question_id, issue_description]
    );

    // Moving email logic after insert to ensure success, but query overhead is fine.
    // Actually, I need to import sendNotification first.

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create NC' });
  }
}

// PUT /api/ncs/:ncId/resolve - Process Owner submits correction
export async function resolveNC(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { ncId } = req.params;
    const { root_cause, corrective_action, evidence_url } = req.body;

    // Get NC
    const ncRes = await pool.query('SELECT * FROM non_conformances WHERE nc_id = $1', [ncId]);
    if (ncRes.rows.length === 0) {
      res.status(404).json({ error: 'NC not found' });
      return;
    }

    const nc = ncRes.rows[0];

    // Verify this is the assigned process owner
    const auditRes = await pool.query('SELECT * FROM audits WHERE audit_id = $1', [nc.audit_id]);
    if (auditRes.rows[0].process_owner_id !== req.user?.user_id) {
      res.status(403).json({ error: 'Only assigned Process Owner can resolve' });
      return;
    }

    // Update NC
    const result = await pool.query(
      `UPDATE non_conformances SET
       root_cause = $1, corrective_action = $2, evidence_url = $3, status = 'Pending_Verification'
       WHERE nc_id = $4 RETURNING *`,
      [root_cause, corrective_action, evidence_url, ncId]
    );

    // Create audit log
    await pool.query(
      `INSERT INTO audit_logs (audit_id, action, actor_id, details)
       VALUES ($1, $2, $3, $4)`,
      [nc.audit_id, 'Process Owner submitted correction', req.user?.user_id, JSON.stringify({ nc_id: ncId })]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to resolve NC' });
  }
}

// PUT /api/ncs/:ncId/verify - L1 verifies the fix
export async function verifyNC(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { ncId } = req.params;

    // Get NC
    const ncRes = await pool.query('SELECT * FROM non_conformances WHERE nc_id = $1', [ncId]);
    if (ncRes.rows.length === 0) {
      res.status(404).json({ error: 'NC not found' });
      return;
    }

    const nc = ncRes.rows[0];

    // Verify this is the assigned L1
    const auditRes = await pool.query('SELECT * FROM audits WHERE audit_id = $1', [nc.audit_id]);
    if (auditRes.rows[0].l1_auditor_id !== req.user?.user_id) {
      res.status(403).json({ error: 'Only assigned L1 can verify' });
      return;
    }

    // Update NC
    const result = await pool.query(
      `UPDATE non_conformances SET
       status = 'Closed', l1_verifier_id = $1, verified_at = CURRENT_TIMESTAMP
       WHERE nc_id = $2 RETURNING *`,
      [req.user?.user_id, ncId]
    );

    // Create audit log
    await pool.query(
      `INSERT INTO audit_logs (audit_id, action, actor_id, details)
       VALUES ($1, $2, $3, $4)`,
      [nc.audit_id, 'L1 verified NC correction', req.user?.user_id, JSON.stringify({ nc_id: ncId })]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to verify NC' });
  }
}

// DELETE /api/ncs/:ncId - Delete NC (only if Open and by L1)
export async function deleteNC(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { ncId } = req.params;

    // Get NC
    const ncRes = await pool.query('SELECT * FROM non_conformances WHERE nc_id = $1', [ncId]);
    if (ncRes.rows.length === 0) {
      res.status(404).json({ error: 'NC not found' });
      return;
    }

    const nc = ncRes.rows[0];

    // Verify status is Open
    if (nc.status !== 'Open') {
      res.status(400).json({ error: 'Can only delete Open NCs' });
      return;
    }

    // Verify this is the assigned L1
    const auditRes = await pool.query('SELECT * FROM audits WHERE audit_id = $1', [nc.audit_id]);
    if (auditRes.rows[0].l1_auditor_id !== req.user?.user_id) {
      res.status(403).json({ error: 'Only assigned L1 can delete' });
      return;
    }

    await pool.query('DELETE FROM non_conformances WHERE nc_id = $1', [ncId]);

    res.json({ message: 'NC deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete NC' });
  }
}
