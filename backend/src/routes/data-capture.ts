import { Router, Response } from 'express';
import pool from '../database/db';
import { AuthRequest } from '../types/index';
import { authenticateToken } from '../middleware/auth';

const router = Router();

async function ensureInProgress(auditId: string) {
  try {
    await pool.query(
      `UPDATE audits SET status = 'In_Progress' WHERE audit_id = $1 AND status = 'Assigned'`,
      [auditId]
    );
  } catch (err) {
    console.error(`⚠️ Failed to update audit status for ${auditId}:`, err);
  }
}

// ============================================================================
// CHECKLIST ANSWERS (TAB 1)
// ============================================================================

router.post('/checklist', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { audit_id, question_id, l1_observation, l1_value, file_url } = req.body;

    if (!audit_id || !question_id) {
      res.status(400).json({ error: 'Missing audit_id or question_id' });
      return;
    }

    console.log(`📝 Saving Checklist Answer: Audit=${audit_id}, Q=${question_id}`);

    const existing = await pool.query(
      `SELECT answer_id, file_url FROM audit_checklist_answers WHERE audit_id = $1 AND question_id = $2`,
      [audit_id, question_id]
    );

    let result;
    if (existing.rows.length > 0) {
      const oldFile = existing.rows[0].file_url;
      result = await pool.query(
        `UPDATE audit_checklist_answers 
         SET l1_observation = $1, 
             l1_value = $2,
             file_url = $3, 
             answered_at = NOW()
         WHERE audit_id = $4 AND question_id = $5
         RETURNING *`,
        [l1_observation, l1_value, file_url || oldFile, audit_id, question_id]
      );
    } else {
      result = await pool.query(
        `INSERT INTO audit_checklist_answers (audit_id, question_id, l1_observation, l1_value, file_url, answered_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         RETURNING *`,
        [audit_id, question_id, l1_observation, l1_value, file_url]
      );
    }

    await ensureInProgress(audit_id);
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('❌ Save Checklist Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// OBJECTIVES LOG (TAB 2)
// ============================================================================

router.get('/:id/objectives', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT * FROM audit_objectives_log WHERE audit_id = $1 ORDER BY recorded_at DESC`,
      [id]
    );
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/objectives', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const {
      audit_id,
      objective_type,
      parameter_name,
      sample_size,
      target_value,
      actual_value,
      tool_target,
      tool_actual,
      machine_target,
      machine_actual,
      remarks
    } = req.body;

    console.log('📝 Saving Objective:', { audit_id, objective_type, parameter_name });

    if (!audit_id || !parameter_name) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO audit_objectives_log (
        audit_id, objective_type, parameter_name, sample_size, 
        target_value, actual_value, tool_target, tool_actual, 
        machine_target, machine_actual, remarks, recorded_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      ON CONFLICT (audit_id, objective_type, parameter_name) DO UPDATE SET
        sample_size = EXCLUDED.sample_size,
        target_value = EXCLUDED.target_value,
        actual_value = EXCLUDED.actual_value,
        tool_target = EXCLUDED.tool_target,
        tool_actual = EXCLUDED.tool_actual,
        machine_target = EXCLUDED.machine_target,
        machine_actual = EXCLUDED.machine_actual,
        remarks = EXCLUDED.remarks,
        recorded_at = NOW()
      RETURNING *`,
      [
        audit_id, objective_type || 'product_characteristic', parameter_name, sample_size,
        target_value, actual_value, tool_target, tool_actual,
        machine_target, machine_actual, remarks
      ]
    );

    await ensureInProgress(audit_id);
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('❌ Save Objective Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// CALIBRATION LOG (TAB 3)
// ============================================================================

router.get('/calibration/:audit_id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { audit_id } = req.params;
    const result = await pool.query(
      `SELECT * FROM audit_calibration_log WHERE audit_id = $1 ORDER BY due_date`,
      [audit_id]
    );
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/calibration', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { audit_id, calibration_id, instrument_name, due_date, grr_details, remarks } = req.body;

    if (!audit_id || !instrument_name) {
      res.status(400).json({ error: 'Missing audit_id or instrument_name' });
      return;
    }

    console.log(`📝 Saving Calibration: Audit=${audit_id}, Instrument=${instrument_name}`);

    const status = due_date && new Date(due_date) < new Date() ? 'Expired' : 'OK';

    const result = await pool.query(
      `INSERT INTO audit_calibration_log (audit_id, instrument_name, due_date, grr_details, remarks, status, recorded_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
       ON CONFLICT (audit_id, instrument_name) DO UPDATE SET
         due_date = EXCLUDED.due_date,
         grr_details = EXCLUDED.grr_details,
         remarks = EXCLUDED.remarks,
         status = EXCLUDED.status,
         recorded_at = NOW()
       RETURNING *`,
      [audit_id, instrument_name, due_date, grr_details, remarks, status]
    );

    await ensureInProgress(audit_id);
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('❌ Save Calibration Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// PARAMETERS LOG (TAB 4)
// ============================================================================

router.get('/parameters/:audit_id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { audit_id } = req.params;
    const result = await pool.query(
      `SELECT * FROM audit_parameter_log WHERE audit_id = $1`,
      [audit_id]
    );
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/parameters', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { audit_id, parameter_id, parameter_name, spec_limit, shift_a_value, shift_b_value, shift_c_value, remarks } = req.body;

    if (!audit_id || !parameter_name) {
      res.status(400).json({ error: 'Missing audit_id or parameter_name' });
      return;
    }

    console.log(`📝 Saving Parameters: Audit=${audit_id}, Parameter=${parameter_name}`);

    const result = await pool.query(
      `INSERT INTO audit_parameter_log (audit_id, parameter_name, spec_limit, shift_a_value, shift_b_value, shift_c_value, remarks, recorded_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
       ON CONFLICT (audit_id, parameter_name) DO UPDATE SET
         spec_limit = EXCLUDED.spec_limit,
         shift_a_value = EXCLUDED.shift_a_value,
         shift_b_value = EXCLUDED.shift_b_value,
         shift_c_value = EXCLUDED.shift_c_value,
         remarks = EXCLUDED.remarks,
         recorded_at = NOW()
       RETURNING *`,
      [audit_id, parameter_name, spec_limit, shift_a_value, shift_b_value, shift_c_value, remarks]
    );

    await ensureInProgress(audit_id);
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('❌ Save Parameters Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// OLD ENDPOINTS (Standardizing to the ones above)
// ============================================================================

// GET /api/audits/:id/answers
router.get('/:id/answers', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT aca.*, q.question_text, q.section_id, ts.section_name
       FROM audit_checklist_answers aca
       JOIN template_questions q ON aca.question_id = q.question_id
       JOIN template_sections ts ON q.section_id = ts.section_id
       WHERE aca.audit_id = $1
       ORDER BY q.question_order`,
      [id]
    );
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/audits/:id/answers - Legacy save
router.post('/:id/answers', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { question_id, l1_observation, raise_nc } = req.body;

    const existing = await pool.query(
      `SELECT answer_id FROM audit_checklist_answers WHERE audit_id = $1 AND question_id = $2`,
      [id, question_id]
    );

    let result;
    if (existing.rows.length > 0) {
      result = await pool.query(
        `UPDATE audit_checklist_answers SET l1_observation = $1, answered_at = CURRENT_TIMESTAMP
         WHERE audit_id = $2 AND question_id = $3 RETURNING *`,
        [l1_observation, id, question_id]
      );
    } else {
      result = await pool.query(
        `INSERT INTO audit_checklist_answers (audit_id, question_id, l1_observation, answered_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP) RETURNING *`,
        [id, question_id, l1_observation]
      );
    }

    if (raise_nc && raise_nc === true) {
      await pool.query(
        `INSERT INTO non_conformances (audit_id, question_id, issue_description, status)
         VALUES ($1, $2, $3, 'Open')
         ON CONFLICT DO NOTHING`,
        [id, question_id, l1_observation]
      );
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// DELETE ROUTES
// ============================================================================

router.delete('/objectives/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM audit_objectives_log WHERE objective_id = $1', [id]);
    res.json({ message: 'Entry deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/calibration/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM audit_calibration_log WHERE calibration_id = $1', [id]);
    res.json({ message: 'Entry deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/parameters/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM audit_parameter_log WHERE parameter_id = $1', [id]);
    res.json({ message: 'Entry deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;