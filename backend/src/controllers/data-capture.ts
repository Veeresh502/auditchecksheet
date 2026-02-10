import { AuthRequest } from '../types/index';
import { Response } from 'express';
import pool from '../database/db';

// POST /api/audits/:id/checklist-answer - Save checklist answer
export async function saveChecklistAnswer(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { question_id, l1_observation, raise_nc } = req.body;

    // Verify audit exists and user is L1
    const auditRes = await pool.query('SELECT * FROM audits WHERE audit_id = $1', [id]);
    if (auditRes.rows.length === 0) {
      res.status(404).json({ error: 'Audit not found' });
      return;
    }

    if (auditRes.rows[0].l1_auditor_id !== req.user?.user_id) {
      res.status(403).json({ error: 'Only L1 can save answers' });
      return;
    }

    // Insert or update answer
    const result = await pool.query(
      `INSERT INTO audit_checklist_answers (audit_id, question_id, l1_observation, answered_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (audit_id, question_id) DO UPDATE SET
       l1_observation = $3, answered_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [id, question_id, l1_observation]
    );

    // If NC is being raised, create a non-conformance record
    if (raise_nc) {
      await pool.query(
        `INSERT INTO non_conformances (audit_id, question_id, issue_description, status, nc_date)
         VALUES ($1, $2, $3, 'Open', CURRENT_DATE)
         ON CONFLICT DO NOTHING`,
        [id, question_id, l1_observation]
      );
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save answer' });
  }
}

// POST /api/audits/:id/objectives - Save objective data
export async function saveObjectiveData(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { parameter_name, target_value, actual_value } = req.body;

    // Verify audit exists
    const auditRes = await pool.query('SELECT * FROM audits WHERE audit_id = $1', [id]);
    if (auditRes.rows.length === 0) {
      res.status(404).json({ error: 'Audit not found' });
      return;
    }

    // Insert or update
    const result = await pool.query(
      `INSERT INTO audit_objectives_log (audit_id, parameter_name, target_value, actual_value, recorded_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (audit_id, parameter_name) DO UPDATE SET
       actual_value = $4, recorded_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [id, parameter_name, target_value, actual_value]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save objective data' });
  }
}

// POST /api/audits/:id/calibration - Save calibration data
export async function saveCalibrationData(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { instrument_name, due_date } = req.body;

    // Verify audit exists
    const auditRes = await pool.query('SELECT * FROM audits WHERE audit_id = $1', [id]);
    if (auditRes.rows.length === 0) {
      res.status(404).json({ error: 'Audit not found' });
      return;
    }

    // Determine status based on due date
    const dueDateTime = new Date(due_date);
    const today = new Date();
    const status = dueDateTime < today ? 'Expired' : 'OK';

    const result = await pool.query(
      `INSERT INTO audit_calibration_log (audit_id, instrument_name, due_date, status, recorded_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       RETURNING *`,
      [id, instrument_name, due_date, status]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save calibration data' });
  }
}

// POST /api/audits/:id/parameters - Save shift parameters
export async function saveParameterData(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { parameter_name, spec_limit, shift_a_value, shift_b_value, shift_c_value } = req.body;

    // Verify audit exists
    const auditRes = await pool.query('SELECT * FROM audits WHERE audit_id = $1', [id]);
    if (auditRes.rows.length === 0) {
      res.status(404).json({ error: 'Audit not found' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO audit_parameter_log (audit_id, parameter_name, spec_limit, shift_a_value, shift_b_value, shift_c_value, recorded_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
       ON CONFLICT (audit_id, parameter_name) DO UPDATE SET
       shift_a_value = $4, shift_b_value = $5, shift_c_value = $6, recorded_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [id, parameter_name, spec_limit, shift_a_value, shift_b_value, shift_c_value]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save parameter data' });
  }
}

// GET /api/audits/:id/progress - Get audit completion progress
export async function getAuditProgress(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    // Get total questions
    const questionsRes = await pool.query(
      `SELECT COUNT(*) FROM template_questions
       WHERE section_id IN (
         SELECT section_id FROM template_sections
         WHERE template_id = (SELECT template_id FROM audits WHERE audit_id = $1)
       )`,
      [id]
    );

    // Get completed answers
    const answersRes = await pool.query(
      'SELECT COUNT(*) FROM audit_checklist_answers WHERE audit_id = $1',
      [id]
    );

    // Get objectives count
    const objRes = await pool.query(
      'SELECT COUNT(*) FROM audit_objectives_log WHERE audit_id = $1',
      [id]
    );

    // Get calibrations count
    const calRes = await pool.query(
      'SELECT COUNT(*) FROM audit_calibration_log WHERE audit_id = $1',
      [id]
    );

    // Get parameters count
    const paramRes = await pool.query(
      'SELECT COUNT(*) FROM audit_parameter_log WHERE audit_id = $1',
      [id]
    );

    const totalQuestions = parseInt(questionsRes.rows[0].count);
    const completedAnswers = parseInt(answersRes.rows[0].count);
    const completedObjectives = parseInt(objRes.rows[0].count);
    const completedCalibrations = parseInt(calRes.rows[0].count);
    const completedParameters = parseInt(paramRes.rows[0].count);

    res.json({
      checklist: {
        total: totalQuestions,
        completed: completedAnswers,
        percentage: totalQuestions > 0 ? (completedAnswers / totalQuestions) * 100 : 0,
      },
      objectives: {
        completed: completedObjectives,
      },
      calibration: {
        completed: completedCalibrations,
      },
      parameters: {
        completed: completedParameters,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get progress' });
  }
}
