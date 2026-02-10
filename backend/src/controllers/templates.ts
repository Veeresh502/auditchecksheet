import { AuthRequest } from '../types/index';
import { Response } from 'express';
import pool from '../database/db';

// GET /api/templates - Get all templates
export async function getTemplates(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await pool.query(
      'SELECT * FROM audit_templates ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
}

// GET /api/templates/:id - Get template with all sections and questions
export async function getTemplateById(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const templateRes = await pool.query(
      'SELECT * FROM audit_templates WHERE template_id = $1',
      [id]
    );

    if (templateRes.rows.length === 0) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    const sectionsRes = await pool.query(
      `SELECT ts.*, COUNT(tq.question_id) as question_count
       FROM template_sections ts
       LEFT JOIN template_questions tq ON ts.section_id = tq.section_id
       WHERE ts.template_id = $1
       GROUP BY ts.section_id
       ORDER BY ts.section_order`,
      [id]
    );

    const template = templateRes.rows[0];
    const sections = [];

    for (const section of sectionsRes.rows) {
      const questionsRes = await pool.query(
        'SELECT * FROM template_questions WHERE section_id = $1 ORDER BY question_order',
        [section.section_id]
      );
      sections.push({
        ...section,
        questions: questionsRes.rows,
      });
    }

    res.json({ ...template, sections });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
}

// POST /api/templates - Create new template (Admin only)
export async function createTemplate(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (req.user?.role !== 'Admin') {
      res.status(403).json({ error: 'Only Admin can create templates' });
      return;
    }

    const { template_name, description } = req.body;

    if (!template_name) {
      res.status(400).json({ error: 'Template name is required' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO audit_templates (template_name, description, created_by)
       VALUES ($1, $2, $3) RETURNING *`,
      [template_name, description, req.user.user_id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create template' });
  }
}

// POST /api/templates/:id/sections - Add section to template (Admin only)
export async function addSection(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (req.user?.role !== 'Admin') {
      res.status(403).json({ error: 'Only Admin can add sections' });
      return;
    }

    const { id } = req.params;
    const { section_name, section_order } = req.body;

    if (!section_name) {
      res.status(400).json({ error: 'Section name is required' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO template_sections (template_id, section_name, section_order)
       VALUES ($1, $2, $3) RETURNING *`,
      [id, section_name, section_order || 1]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add section' });
  }
}

// POST /api/templates/:id/sections/:secId/questions - Add question (Admin only)
export async function addQuestion(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (req.user?.role !== 'Admin') {
      res.status(403).json({ error: 'Only Admin can add questions' });
      return;
    }

    const { id, secId } = req.params;
    const { question_text, input_type, question_order } = req.body;

    if (!question_text) {
      res.status(400).json({ error: 'Question text is required' });
      return;
    }

    const validInputTypes = ['standard', 'calibration_row', 'shift_reading'];
    const type = input_type || 'standard';

    if (!validInputTypes.includes(type)) {
      res.status(400).json({ error: 'Invalid input type' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO template_questions (section_id, question_text, input_type, question_order)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [secId, question_text, type, question_order || 1]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add question' });
  }
}
