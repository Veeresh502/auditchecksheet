import { AuthRequest } from '../types/index';
import { Response } from 'express';
import pool from '../database/db';

// PUT /api/audits/:id/score - L2 scores an answer
export async function scoreAnswer(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { answer_id, score, comment } = req.body;

    // Validate score
    if (![0, 1, 2].includes(score)) {
      res.status(400).json({ error: 'Score must be 0, 1, or 2' });
      return;
    }

    // Verify audit exists and user is L2
    const auditRes = await pool.query('SELECT * FROM audits WHERE audit_id = $1', [id]);
    if (auditRes.rows.length === 0) {
      res.status(404).json({ error: 'Audit not found' });
      return;
    }

    if (auditRes.rows[0].l2_auditor_id !== req.user?.user_id) {
      res.status(403).json({ error: 'Only L2 can score answers' });
      return;
    }

    // Update answer with score
    const result = await pool.query(
      `UPDATE audit_checklist_answers SET
       l2_score = $1, l2_remarks = $2, scored_at = CURRENT_TIMESTAMP
       WHERE answer_id = $3 RETURNING *`,
      [score, comment, answer_id]
    );

    // Create audit log
    await pool.query(
      `INSERT INTO audit_logs (audit_id, action, actor_id, details)
       VALUES ($1, $2, $3, $4)`,
      [id, 'Scored answer', req.user?.user_id, JSON.stringify({ answer_id, score })]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to score answer' });
  }
}

// GET /api/audits/:id/compliance-score - Get overall compliance score
export async function getComplianceScore(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    // Get all scored answers
    const result = await pool.query(
      `SELECT l2_score, COUNT(*) as count
       FROM audit_checklist_answers
       WHERE audit_id = $1 AND l2_score IS NOT NULL
       GROUP BY l2_score`,
      [id]
    );

    let totalScore = 0;
    let totalCount = 0;
    const breakdown: { [key: number]: number } = { 0: 0, 1: 0, 2: 0 };

    for (const row of result.rows) {
      breakdown[row.l2_score as number] = parseInt(row.count);
      totalScore += row.l2_score * parseInt(row.count);
      totalCount += parseInt(row.count);
    }

    const averageScore = totalCount > 0 ? totalScore / totalCount : 0;
    const compliancePercentage = totalCount > 0 ? (averageScore / 2) * 100 : 0;

    res.json({
      average_score: averageScore.toFixed(2),
      compliance_percentage: compliancePercentage.toFixed(2),
      breakdown,
      total_scored: totalCount,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to calculate score' });
  }
}

// PUT /api/audits/:id/approve - L2 approves and completes audit
export async function approveAudit(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    // Verify audit exists and user is L2
    const auditRes = await pool.query('SELECT * FROM audits WHERE audit_id = $1', [id]);
    if (auditRes.rows.length === 0) {
      res.status(404).json({ error: 'Audit not found' });
      return;
    }

    if (auditRes.rows[0].l2_auditor_id !== req.user?.user_id) {
      res.status(403).json({ error: 'Only L2 can approve audits' });
      return;
    }

    // Check if all answers are scored
    const unscoredRes = await pool.query(
      `SELECT COUNT(*) FROM audit_checklist_answers
       WHERE audit_id = $1 AND l2_score IS NULL`,
      [id]
    );

    if (parseInt(unscoredRes.rows[0].count) > 0) {
      res.status(400).json({ error: 'All answers must be scored before approval' });
      return;
    }

    // Check if all NCs are closed
    const openNcsRes = await pool.query(
      `SELECT COUNT(*) FROM non_conformances
       WHERE audit_id = $1 AND status != 'Closed'`,
      [id]
    );

    if (parseInt(openNcsRes.rows[0].count) > 0) {
      res.status(400).json({ error: 'All NCs must be closed before approval' });
      return;
    }

    // Update audit status
    const result = await pool.query(
      `UPDATE audits SET status = 'Completed', updated_at = CURRENT_TIMESTAMP WHERE audit_id = $1 RETURNING *`,
      [id]
    );

    // Create audit log
    await pool.query(
      `INSERT INTO audit_logs (audit_id, action, actor_id, details)
       VALUES ($1, $2, $3, $4)`,
      [id, 'Audit approved and completed', req.user?.user_id, null]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to approve audit' });
  }
}

// PUT /api/audits/:id/reject - L2 rejects and returns audit to L1
export async function rejectAudit(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      res.status(400).json({ error: 'Rejection reason is required' });
      return;
    }

    // Verify audit exists and user is L2
    const auditRes = await pool.query('SELECT * FROM audits WHERE audit_id = $1', [id]);
    if (auditRes.rows.length === 0) {
      res.status(404).json({ error: 'Audit not found' });
      return;
    }

    if (auditRes.rows[0].l2_auditor_id !== req.user?.user_id) {
      res.status(403).json({ error: 'Only L2 can reject audits' });
      return;
    }

    // Reset scores
    await pool.query(
      `UPDATE audit_checklist_answers SET l2_score = NULL, l2_remarks = NULL, scored_at = NULL
       WHERE audit_id = $1`,
      [id]
    );

    // Return to Rejected status
    const result = await pool.query(
      `UPDATE audits SET status = 'Rejected', updated_at = CURRENT_TIMESTAMP WHERE audit_id = $1 RETURNING *`,
      [id]
    );

    // Create audit log
    await pool.query(
      `INSERT INTO audit_logs (audit_id, action, actor_id, details)
       VALUES ($1, $2, $3, $4)`,
      [id, 'Rejected_by_L2', req.user?.user_id, JSON.stringify({ reason })]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to reject audit' });
  }
}
