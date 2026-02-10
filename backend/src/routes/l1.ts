import { Router } from 'express';
import pool from '../database/db';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// GET /api/l1/audits - audits assigned to logged-in L1
router.get('/audits', authenticateToken, async (req: any, res) => {
  try {
    if (req.user.role !== 'L1_Auditor') {
      return res.status(403).json({ error: 'Only L1 users allowed' });
    }

    const result = await pool.query(
      `SELECT audit_id, machine_name, audit_date, shift, status
       FROM audits
       WHERE l1_auditor_id = $1
       ORDER BY audit_date DESC`,
      [req.user.user_id]
    );

    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
