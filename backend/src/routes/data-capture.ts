import { Router, Response } from 'express';
import pool from '../database/db';
import { AuthRequest } from '../types/index';
import { authenticateToken } from '../middleware/auth';

const router = Router();

async function ensureInProgress(auditId: string) {
  await pool.query(
    `UPDATE audits SET status = 'In_Progress' WHERE audit_id = $1 AND status = 'Assigned'`,
    [auditId]
  );
}

// ============================================================================
// CHECKLIST ANSWERS
// ============================================================================

// POST /api/answers/checklist - Save checklist observations (Tab 1)
// router.post('/checklist', authenticateToken, async (req: AuthRequest, res: Response) => {
//   try {
//     const { audit_id, question_id, l1_observation } = req.body;

//     if (!audit_id || !question_id) {
//       res.status(400).json({ error: 'Missing audit_id or question_id' });
//       return;
//     }

//     const existing = await pool.query(
//       `SELECT answer_id FROM audit_checklist_answers WHERE audit_id = $1 AND question_id = $2`,
//       [audit_id, question_id]
//     );

//     let result;
//     if (existing.rows.length > 0) {
//       result = await pool.query(
//         `UPDATE audit_checklist_answers SET l1_observation = $1, answered_at = NOW()
//          WHERE audit_id = $2 AND question_id = $3 RETURNING *`,
//         [l1_observation, audit_id, question_id]
//       );
//     } else {
//       result = await pool.query(
//         `INSERT INTO audit_checklist_answers (audit_id, question_id, l1_observation, answered_at)
//          VALUES ($1, $2, $3, NOW()) RETURNING *`,
//         [audit_id, question_id, l1_observation]
//       );
//     }

//     res.json(result.rows[0]);
//   } catch (error: any) {
//     res.status(500).json({ error: error.message });
//   }
// });
// OR
// POST /api/answers/checklist - Save checklist observations & file
router.post('/checklist', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { audit_id, question_id, l1_observation, l1_value, file_url } = req.body;

    if (!audit_id || !question_id) {
      res.status(400).json({ error: 'Missing audit_id or question_id' });
      return;
    }

    // Check existence manually to be safe
    const existing = await pool.query(
      `SELECT answer_id, file_url FROM audit_checklist_answers WHERE audit_id = $1 AND question_id = $2`,
      [audit_id, question_id]
    );

    let result;
    if (existing.rows.length > 0) {
      const oldFile = existing.rows[0].file_url;
      // Update
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
      // Insert
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
    res.status(500).json({ error: error.message });
  }
});

// POST /api/answers/objectives - Save objectives data (Tab 2)
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

    if (!audit_id || !parameter_name) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Upsert logic for objectives based on audit_id, objective_type, and parameter_name
    const existing = await pool.query(
      `SELECT objective_id FROM audit_objectives_log 
       WHERE audit_id = $1 AND objective_type = $2 AND parameter_name = $3`,
      [audit_id, objective_type || 'product_characteristic', parameter_name]
    );

    let result;
    if (existing.rows.length > 0) {
      result = await pool.query(
        `UPDATE audit_objectives_log 
         SET sample_size = $1, 
             target_value = $2, 
             actual_value = $3, 
             tool_target = $4,
             tool_actual = $5,
             machine_target = $6,
             machine_actual = $7,
             remarks = $8,
             recorded_at = NOW()
         WHERE objective_id = $9
         RETURNING *`,
        [
          sample_size, target_value, actual_value,
          tool_target, tool_actual, machine_target, machine_actual,
          remarks, existing.rows[0].objective_id
        ]
      );
    } else {
      result = await pool.query(
        `INSERT INTO audit_objectives_log (
          audit_id, objective_type, parameter_name, sample_size, 
          target_value, actual_value, tool_target, tool_actual, 
          machine_target, machine_actual, remarks, recorded_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW()) RETURNING *`,
        [
          audit_id, objective_type || 'product_characteristic', parameter_name, sample_size,
          target_value, actual_value, tool_target, tool_actual,
          machine_target, machine_actual, remarks
        ]
      );
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/answers/calibration - Add calibration row (Tab 3)
router.post('/calibration', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { audit_id, instrument_name, due_date, grr_details, remarks } = req.body;

    if (!audit_id || !instrument_name || !due_date) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const status = new Date(due_date) < new Date() ? 'Expired' : 'OK';

    const result = await pool.query(
      `INSERT INTO audit_calibration_log (audit_id, instrument_name, due_date, status, grr_details, remarks, recorded_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *`,
      [audit_id, instrument_name, due_date, status, grr_details, remarks]
    );

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/answers/parameters - Save shift parameters (Tab 4)
router.post('/parameters', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { audit_id, parameter_name, spec_limit, shift_a_value, shift_b_value, shift_c_value, remarks } = req.body;

    const result = await pool.query(
      `INSERT INTO audit_parameter_log (audit_id, parameter_name, spec_limit, shift_a_value, shift_b_value, shift_c_value, remarks, recorded_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING *`,
      [audit_id, parameter_name, spec_limit, shift_a_value, shift_b_value, shift_c_value, remarks]
    );

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

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

// POST /api/audits/:id/answers - Save checklist answer
router.post('/:id/answers', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { question_id, l1_observation, raise_nc } = req.body;

    // Check if answer already exists
    const existing = await pool.query(
      `SELECT answer_id FROM audit_checklist_answers WHERE audit_id = $1 AND question_id = $2`,
      [id, question_id]
    );

    let result;
    if (existing.rows.length > 0) {
      // Update
      result = await pool.query(
        `UPDATE audit_checklist_answers SET l1_observation = $1, answered_at = CURRENT_TIMESTAMP
         WHERE audit_id = $2 AND question_id = $3 RETURNING *`,
        [l1_observation, id, question_id]
      );
    } else {
      // Insert
      result = await pool.query(
        `INSERT INTO audit_checklist_answers (audit_id, question_id, l1_observation, answered_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP) RETURNING *`,
        [id, question_id, l1_observation]
      );
    }

    // If NC needs to be raised
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
// OBJECTIVES LOG
// ============================================================================

// GET /api/audits/:id/objectives
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

// POST /api/audits/:id/objectives
router.post('/:id/objectives', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { parameter_name, target_value, actual_value } = req.body;

    const result = await pool.query(
      `INSERT INTO audit_objectives_log (audit_id, parameter_name, target_value, actual_value, recorded_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP) RETURNING *`,
      [id, parameter_name, target_value, actual_value]
    );

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// CALIBRATION LOG
// ============================================================================

// GET /api/answers/calibration/:audit_id
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

// POST /api/answers/calibration - Upsert
router.post('/calibration', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { audit_id, calibration_id, instrument_name, due_date, grr_details, remarks } = req.body;

    if (!audit_id || !instrument_name) {
      res.status(400).json({ error: 'Missing audit_id or instrument_name' });
      return;
    }

    // Check if due_date has passed for status
    const status = due_date && new Date(due_date) < new Date() ? 'Expired' : 'OK';

    let existing;
    if (calibration_id) {
      existing = await pool.query('SELECT calibration_id FROM audit_calibration_log WHERE calibration_id = $1', [calibration_id]);
    } else {
      existing = await pool.query(
        'SELECT calibration_id FROM audit_calibration_log WHERE audit_id = $1 AND instrument_name = $2',
        [audit_id, instrument_name]
      );
    }

    let result;
    if (existing.rows.length > 0) {
      result = await pool.query(
        `UPDATE audit_calibration_log 
         SET due_date = $1, grr_details = $2, remarks = $3, status = $4, recorded_at = NOW()
         WHERE calibration_id = $5 RETURNING *`,
        [due_date, grr_details, remarks, status, existing.rows[0].calibration_id]
      );
    } else {
      result = await pool.query(
        `INSERT INTO audit_calibration_log (audit_id, instrument_name, due_date, grr_details, remarks, status, recorded_at)
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP) RETURNING *`,
        [audit_id, instrument_name, due_date, grr_details, remarks, status]
      );
    }
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// PARAMETERS LOG
// ============================================================================

// GET /api/answers/parameters/:audit_id
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

// POST /api/answers/parameters - Upsert
router.post('/parameters', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { audit_id, parameter_id, parameter_name, spec_limit, shift_a_value, shift_b_value, shift_c_value, remarks } = req.body;

    if (!audit_id || !parameter_name) {
      res.status(400).json({ error: 'Missing audit_id or parameter_name' });
      return;
    }

    let existing;
    if (parameter_id) {
      existing = await pool.query('SELECT parameter_id FROM audit_parameter_log WHERE parameter_id = $1', [parameter_id]);
    } else {
      existing = await pool.query(
        'SELECT parameter_id FROM audit_parameter_log WHERE audit_id = $1 AND parameter_name = $2',
        [audit_id, parameter_name]
      );
    }

    let result;
    if (existing.rows.length > 0) {
      result = await pool.query(
        `UPDATE audit_parameter_log 
         SET spec_limit = $1, shift_a_value = $2, shift_b_value = $3, shift_c_value = $4, remarks = $5, recorded_at = NOW()
         WHERE parameter_id = $6 RETURNING *`,
        [spec_limit, shift_a_value, shift_b_value, shift_c_value, remarks, existing.rows[0].parameter_id]
      );
    } else {
      result = await pool.query(
        `INSERT INTO audit_parameter_log (audit_id, parameter_name, spec_limit, shift_a_value, shift_b_value, shift_c_value, remarks, recorded_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP) RETURNING *`,
        [audit_id, parameter_name, spec_limit, shift_a_value, shift_b_value, shift_c_value, remarks]
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

// DELETE /api/answers/objectives/:id
router.delete('/objectives/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM audit_objectives_log WHERE objective_id = $1', [id]);
    res.json({ message: 'Entry deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/answers/calibration/:id
router.delete('/calibration/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM audit_calibration_log WHERE calibration_id = $1', [id]);
    res.json({ message: 'Entry deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/answers/parameters/:id
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