import { Router, Response } from 'express';
import pool from '../database/db';
import { AuthRequest } from '../types/index';
import { authenticateToken, authorizeRole } from '../middleware/auth';
import { sendNotification } from '../services/emailService';

const router = Router();

// ============================================================================
// L2 SCORING ENDPOINTS
// ============================================================================


router.put('/:auditId/score', authenticateToken, authorizeRole('L2_Auditor'), async (req: AuthRequest, res: Response) => {
  try {
    const { auditId } = req.params;
    const { question_id, l2_score, l2_remarks } = req.body;

    if (l2_score === undefined || ![0, 1, 2, 3].includes(l2_score)) {
      res.status(400).json({ error: 'Invalid score. Must be 0, 1, 2, or 3 (NA)' });
      return;
    }

    // Check if answer row exists (L1 might have skipped it)
    const existing = await pool.query(
      `SELECT answer_id FROM audit_checklist_answers WHERE audit_id = $1 AND question_id = $2`,
      [auditId, question_id]
    );

    let result;
    if (existing.rows.length > 0) {
      // Update existing row
      result = await pool.query(
        `UPDATE audit_checklist_answers 
         SET l2_score = $1, l2_remarks = $2, scored_at = CURRENT_TIMESTAMP
         WHERE audit_id = $3 AND question_id = $4
         RETURNING *`,
        [l2_score, l2_remarks || null, auditId, question_id]
      );
    } else {
      // Insert new row (L2 scoring first)
      result = await pool.query(
        `INSERT INTO audit_checklist_answers (audit_id, question_id, l2_score, l2_remarks, scored_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
         RETURNING *`,
        [auditId, question_id, l2_score, l2_remarks || null]
      );
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/audits/:id/scores - Get all scores for an audit
router.get('/:auditId/scores', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { auditId } = req.params;

    const result = await pool.query(
      `SELECT aca.*, q.question_text, ts.section_name
       FROM audit_checklist_answers aca
       JOIN template_questions q ON aca.question_id = q.question_id
       JOIN template_sections ts ON q.section_id = ts.section_id
       WHERE aca.audit_id = $1
       ORDER BY q.question_order`,
      [auditId]
    );

    // Calculate statistics
    const totalQuestions = result.rows.length;

    // Scored questions includes NA (3) because they are "handled"
    const scoredQuestions = result.rows.filter(r => r.l2_score !== null).length;

    // For compliance, we EXCLUDE NA (3) from both numerator and denominator
    const applicableQuestions = result.rows.filter(r => r.l2_score !== null && r.l2_score !== 3);
    const totalMaxScore = applicableQuestions.length * 2;
    const obtainedScore = applicableQuestions.reduce((sum, r) => sum + (r.l2_score || 0), 0);

    const complianceScore = totalMaxScore > 0
      ? Math.round((obtainedScore / totalMaxScore) * 100)
      : 100; // If all are NA, strictly speaking 100% compliance or N/A. Let's say 100.

    res.json({
      answers: result.rows,
      statistics: {
        totalQuestions,
        scoredQuestions,
        pendingQuestions: totalQuestions - scoredQuestions,
        compliancePercentage: complianceScore
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/audits/:id/approve - L2 approves and completes audit
router.put('/:auditId/approve', authenticateToken, authorizeRole('L2_Auditor', 'Admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { auditId } = req.params;

    // Check if all questions are scored
    const unscored = await pool.query(
      `SELECT COUNT(*) FROM audit_checklist_answers WHERE audit_id = $1 AND l2_score IS NULL`,
      [auditId]
    );

    if (unscored.rows[0].count > 0) {
      res.status(400).json({ error: 'All questions must be scored before approval' });
      return;
    }

    // CHECK: Are there any Open NCs?
    const ncRes = await pool.query(
      `SELECT COUNT(*) FROM non_conformances 
       WHERE audit_id = $1 AND status != 'Closed'`,
      [auditId]
    );

    if (parseInt(ncRes.rows[0].count) > 0) {
      res.status(400).json({
        error: 'Cannot approve audit: There are unclosed Non-Conformances. NCs must be resolved and verified before approval.'
      });
      return;
    }

    const result = await pool.query(
      `UPDATE audits SET status = 'Completed', updated_at = CURRENT_TIMESTAMP WHERE audit_id = $1 RETURNING *`,
      [auditId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Audit not found' });
      return;
    }

    // --- NEW: Email Admin (Notify completion) ---
    // Assuming Admin is user with ID 1 or we query for Admins. For simplicity, let's query all Admins.
    const adminRes = await pool.query(`SELECT email FROM users WHERE role = 'Admin'`);
    for (const row of adminRes.rows) {
      await sendNotification(
        row.email,
        `Audit Completed: ${result.rows[0].machine_name}`,
        `Hello Admin,\n\nThe audit for ${result.rows[0].machine_name} has been Approved and Closed by the L2 Auditor.\n\n- DANA Audit System`
      );
    }
    // -------------------------------------------

    res.json({
      message: 'Audit completed successfully',
      audit: result.rows[0]
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/audits/:id/reject - L2 rejects audit (send back to L1)
router.put('/:auditId/reject', authenticateToken, authorizeRole('L2_Auditor', 'Admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { auditId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      res.status(400).json({ error: 'Rejection reason is required' });
      return;
    }

    const result = await pool.query(
      `UPDATE audits SET status = 'Rejected', updated_at = CURRENT_TIMESTAMP WHERE audit_id = $1 RETURNING *`,
      [auditId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Audit not found' });
      return;
    }

    // Log the rejection
    await pool.query(
      `INSERT INTO audit_logs (audit_id, action, actor_id, details)
       VALUES ($1, 'Rejected_by_L2', $2, $3)`,
      [auditId, req.user?.user_id, JSON.stringify({ reason })]
    );

    // --- NEW: Email L1 Auditor ---
    const l1Res = await pool.query(
      `SELECT u.email, u.full_name, a.machine_name 
       FROM audits a 
       JOIN users u ON a.l1_auditor_id = u.user_id 
       WHERE a.audit_id = $1`,
      [auditId]
    );
    if (l1Res.rows.length > 0) {
      const { email, full_name, machine_name } = l1Res.rows[0];
      await sendNotification(
        email,
        `Action Required: Audit Rejected for ${machine_name}`,
        `Hello ${full_name},\n\nYour audit for ${machine_name} was rejected by the L2 Auditor.\nReason: "${reason}"\n\nPlease check your dashboard and make the necessary corrections.\n\n- DANA Audit System`
      );
    }
    // ----------------------------

    res.json({
      message: 'Audit rejected and returned to L1',
      audit: result.rows[0]
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;