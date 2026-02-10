import { Router, Response } from 'express';
import pool from '../database/db';
import { AuthRequest } from '../types/index';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// ============================================================================
// ANALYTICS & EXPORTS
// ============================================================================

// GET /api/analytics/summary - Get dashboard statistics
router.get('/summary', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Get open NCs count
    const openNcsResult = await pool.query(
      `SELECT COUNT(*) as count FROM non_conformances WHERE status != 'Closed'`
    );
    const openNcs = parseInt(openNcsResult.rows[0].count);

    // Get pending audits (Submitted_to_L2)
    const pendingAuditsResult = await pool.query(
      `SELECT COUNT(*) as count FROM audits WHERE status = 'Submitted_to_L2'`
    );
    const pendingAudits = parseInt(pendingAuditsResult.rows[0].count);

    // Get completed audits this month
    const completedResult = await pool.query(
      `SELECT COUNT(*) as count FROM audits 
       WHERE status = 'Completed' 
       AND EXTRACT(MONTH FROM audit_date) = EXTRACT(MONTH FROM NOW())
       AND EXTRACT(YEAR FROM audit_date) = EXTRACT(YEAR FROM NOW())`
    );
    const completedThisMonth = parseInt(completedResult.rows[0].count);

    // Get average compliance score
    const avgScoreResult = await pool.query(
      `SELECT AVG(COALESCE(l2_score, 0)) as avg_score 
       FROM audit_checklist_answers 
       WHERE l2_score IS NOT NULL`
    );
    const avgScore = avgScoreResult.rows[0].avg_score
      ? Math.round(parseFloat(avgScoreResult.rows[0].avg_score) / 2 * 100)
      : 0;

    // Get on-time completion percentage
    const totalAuditsResult = await pool.query(
      `SELECT COUNT(*) as count FROM audits WHERE status = 'Completed'`
    );
    const totalCompleted = parseInt(totalAuditsResult.rows[0].count);

    const onTimeResult = await pool.query(
      `SELECT COUNT(*) as count FROM audits 
       WHERE status = 'Completed' 
       AND updated_at <= audit_date + INTERVAL '7 days'`
    );
    const onTimeCount = parseInt(onTimeResult.rows[0].count);
    const onTimePercentage = totalCompleted > 0
      ? Math.round((onTimeCount / totalCompleted) * 100)
      : 0;

    res.json({
      summary: {
        open_ncs: openNcs,
        pending_reviews: pendingAudits,
        completed_this_month: completedThisMonth,
        avg_compliance_score: avgScore,
        on_time_completion_percentage: onTimePercentage
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/exports/audit/:id - Export audit details (JSON format - can be converted to PDF/Excel by frontend)
router.get('/audit/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Get audit details
    const auditRes = await pool.query(
      `SELECT a.*, t.template_name,
              u1.full_name as l1_auditor_name, u1.email as l1_email,
              u2.full_name as l2_auditor_name, u2.email as l2_email,
              u3.full_name as process_owner_name, u3.email as process_owner_email
       FROM audits a
       LEFT JOIN audit_templates t ON a.template_id = t.template_id
       LEFT JOIN users u1 ON a.l1_auditor_id = u1.user_id
       LEFT JOIN users u2 ON a.l2_auditor_id = u2.user_id
       LEFT JOIN users u3 ON a.process_owner_id = u3.user_id
       WHERE a.audit_id = $1`,
      [id]
    );

    if (auditRes.rows.length === 0) {
      res.status(404).json({ error: 'Audit not found' });
      return;
    }

    const audit = auditRes.rows[0];

    // Get all audit data
    const [answers, objectives, calibrations, parameters, ncs] = await Promise.all([
      pool.query(
        `SELECT aca.*, q.question_text FROM audit_checklist_answers aca
         LEFT JOIN template_questions q ON aca.question_id = q.question_id
         WHERE aca.audit_id = $1 ORDER BY aca.answered_at`,
        [id]
      ),
      pool.query(
        `SELECT * FROM audit_objectives_log WHERE audit_id = $1 ORDER BY recorded_at`,
        [id]
      ),
      pool.query(
        `SELECT * FROM audit_calibration_log WHERE audit_id = $1 ORDER BY recorded_at`,
        [id]
      ),
      pool.query(
        `SELECT * FROM audit_parameter_log WHERE audit_id = $1 ORDER BY recorded_at`,
        [id]
      ),
      pool.query(
        `SELECT * FROM non_conformances WHERE audit_id = $1 ORDER BY created_at DESC`,
        [id]
      )
    ]);

    const exportData = {
      audit: {
        audit_id: audit.audit_id,
        template_name: audit.template_name,
        machine_name: audit.machine_name,
        audit_date: audit.audit_date,
        shift: audit.shift,
        status: audit.status,
        l1_auditor: audit.l1_auditor_name,
        l2_auditor: audit.l2_auditor_name,
        process_owner: audit.process_owner_name
      },
      data: {
        checklist: answers.rows,
        objectives: objectives.rows,
        calibrations: calibrations.rows,
        parameters: parameters.rows
      },
      non_conformances: ncs.rows,
      exported_at: new Date().toISOString()
    };

    res.json(exportData);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/analytics/dock-sub - Get specific analytics for dock audits
router.get('/dock-sub', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'Admin') {
      res.status(403).json({ error: 'Only admins can access this' });
      return;
    }

    // 1. Scheduled Audits (Assigned, but not yet completed)
    const scheduledRes = await pool.query(
      `SELECT COUNT(*) as count FROM audits WHERE status = 'Assigned'`
    );

    // 2. Completed Audits (After scoring of L2)
    const completedRes = await pool.query(
      `SELECT COUNT(*) as count FROM audits WHERE status = 'Completed'`
    );

    // 3. NC raised in total
    const ncRes = await pool.query(
      `SELECT COUNT(*) as count FROM non_conformances`
    );

    // 4. Rejected Audits (By L2) - Cumulative count from logs
    const rejectedRes = await pool.query(
      `SELECT COUNT(*) as count FROM audit_logs WHERE action = 'Rejected_by_L2'`
    );

    // 5. Monthly Completion Trend (Last 6 months)
    const trendRes = await pool.query(
      `SELECT 
        TO_CHAR(audit_date, 'Mon') as month,
        COUNT(*) as count
       FROM audits 
       WHERE status = 'Completed'
       AND audit_date >= NOW() - INTERVAL '6 months'
       GROUP BY TO_CHAR(audit_date, 'Mon'), EXTRACT(MONTH FROM audit_date)
       ORDER BY EXTRACT(MONTH FROM audit_date)`
    );

    // 6. NC Status Breakdown
    const ncBreakdownRes = await pool.query(
      `SELECT status, COUNT(*) as count FROM non_conformances GROUP BY status`
    );

    res.json({
      scheduled: parseInt(scheduledRes.rows[0].count),
      completed: parseInt(completedRes.rows[0].count),
      nc_total: parseInt(ncRes.rows[0].count),
      rejected: parseInt(rejectedRes.rows[0].count),
      monthly_trend: trendRes.rows,
      nc_breakdown: ncBreakdownRes.rows
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
