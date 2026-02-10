import express from "express";
import pool from "../database/db";
import { authenticateToken, authorizeRole } from "../middleware/auth";
import { upload } from "../middleware/upload";
import { parse } from "csv-parse/sync";
import fs from "fs";
import { AuthRequest } from "../types/index";

const router = express.Router();

/* =====================================================
   1. GET /api/templates — List all templates
===================================================== */
router.get("/", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT template_id, template_name, description, created_by, created_at
      FROM audit_templates
      ORDER BY created_at DESC
    `);

    res.json(result.rows);
  } catch (error: any) {
    console.error("Error fetching templates:", error);
    res.status(500).json({ error: error.message });
  }
});

/* =====================================================
   2. GET /api/templates/:id — Template with sections + questions
===================================================== */
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch template
    const templateRes = await pool.query(
      `SELECT * FROM audit_templates WHERE template_id = $1`,
      [id]
    );

    if (templateRes.rowCount === 0) {
      return res.status(404).json({ error: "Template not found" });
    }

    // Fetch sections
    const sectionsRes = await pool.query(
      `SELECT * FROM template_sections 
       WHERE template_id = $1
       ORDER BY section_order ASC`,
      [id]
    );

    const sections = sectionsRes.rows;

    // Fetch questions
    const questionsRes = await pool.query(
      `SELECT * FROM template_questions 
       WHERE section_id IN (
         SELECT section_id FROM template_sections WHERE template_id = $1
       )
       ORDER BY question_order ASC`,
      [id]
    );

    const questions = questionsRes.rows;

    // Attach questions to corresponding sections
    const combined = sections.map((section) => ({
      ...section,
      questions: questions.filter((q) => q.section_id === section.section_id),
    }));

    res.json({
      template: templateRes.rows[0],
      sections: combined,
    });
  } catch (error: any) {
    console.error("Error fetching template:", error);
    res.status(500).json({ error: error.message });
  }
});

/* =====================================================
   3. POST /api/templates — Create template (Admin only)
===================================================== */
router.post(
  "/",
  authenticateToken,
  authorizeRole("Admin"),
  async (req: any, res) => {
    try {
      const { template_name, description } = req.body;
      const creatorId = req.user.user_id;

      if (!template_name) {
        return res.status(400).json({ error: "Template name is required" });
      }

      const result = await pool.query(
        `INSERT INTO audit_templates (template_name, description, created_by)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [template_name, description || null, creatorId]
      );

      res.status(201).json(result.rows[0]);
    } catch (error: any) {
      console.error("Error creating template:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

/* =====================================================
   4. POST /api/templates/:id/sections — Add section
===================================================== */
router.post(
  "/:id/sections",
  authenticateToken,
  authorizeRole("Admin"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { section_name, section_order } = req.body;

      if (!section_name || !section_order) {
        return res
          .status(400)
          .json({ error: "Section name and section_order are required" });
      }

      const result = await pool.query(
        `INSERT INTO template_sections (template_id, section_name, section_order)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [id, section_name, section_order]
      );

      res.status(201).json(result.rows[0]);
    } catch (error: any) {
      console.error("Error adding section:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

/* =====================================================
   5. POST /api/templates/:id/sections/:secId/questions — Add question
===================================================== */
router.post(
  "/:id/sections/:secId/questions",
  authenticateToken,
  authorizeRole("Admin"),
  async (req, res) => {
    try {
      const { secId } = req.params;
      const { question_text, input_type, question_order } = req.body;

      if (!question_text || !question_order) {
        return res
          .status(400)
          .json({ error: "Question text and question_order are required" });
      }

      const validTypes = ["standard", "calibration_row", "shift_reading"];
      const finalType = validTypes.includes(input_type)
        ? input_type
        : "standard";

      const result = await pool.query(
        `INSERT INTO template_questions 
         (section_id, question_text, input_type, question_order)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [secId, question_text, finalType, question_order]
      );

      res.status(201).json(result.rows[0]);
    } catch (error: any) {
      console.error("Error adding question:", error);
      res.status(500).json({ error: error.message });
    }
  }
);



/* =====================================================
   6. PUT /api/templates/questions/:id — Update question
===================================================== */
router.put(
  "/questions/:id",
  authenticateToken,
  authorizeRole("Admin"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { question_text, input_type } = req.body;

      if (!question_text) {
        return res.status(400).json({ error: "Question text is required" });
      }

      const result = await pool.query(
        `UPDATE template_questions 
         SET question_text = $1, input_type = $2
         WHERE question_id = $3
         RETURNING *`,
        [question_text, input_type || 'standard', id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Question not found" });
      }

      res.json(result.rows[0]);
    } catch (error: any) {
      console.error("Error updating question:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

/* =====================================================
   7. DELETE /api/templates/questions/:id — Delete question
===================================================== */
router.delete(
  "/questions/:id",
  authenticateToken,
  authorizeRole("Admin"),
  async (req, res) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        `DELETE FROM template_questions WHERE question_id = $1 RETURNING *`,
        [id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Question not found" });
      }

      res.json({ message: "Question deleted successfully", deletedId: id });
    } catch (error: any) {
      console.error("Error deleting question:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

/* =====================================================
   8. POST /api/templates/import-csv — Import from CSV
===================================================== */
router.post(
  "/import-csv",
  authenticateToken,
  authorizeRole("Admin"),
  upload.single("file"),
  async (req: any, res) => {
    const client = await pool.connect();
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const fileContent = fs.readFileSync(req.file.path, "utf-8");

      // Parse CSV synchronously
      const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as any[];

      if (records.length === 0) {
        return res.status(400).json({ error: "CSV file is empty" });
      }

      await client.query("BEGIN");

      // 1. Group records by Template Name
      // Assuming one CSV contains one template for simplicity, 
      // but we'll support multiple if they share the same Template Name.
      const firstRecord = records[0];
      const templateName = firstRecord["Template Name"] || "Imported Template";
      const templateDesc = firstRecord["Description"] || `Imported on ${new Date().toLocaleDateString()}`;

      // Create Template
      const templateRes = await client.query(
        `INSERT INTO audit_templates (template_name, description, created_by)
         VALUES ($1, $2, $3)
         RETURNING template_id`,
        [templateName, templateDesc, req.user.user_id]
      );
      const templateId = templateRes.rows[0].template_id;

      // 2. Track sections to avoid duplicates
      const sectionsMap = new Map<string, number>();
      let sectionOrder = 1;
      let questionOrder = 1;

      for (const record of records) {
        const secName = record["Section Name"] || "General Section";
        const qText = record["Question Text"];
        const qType = record["Input Type"] || "standard";

        if (!qText) continue;

        let sectionId: number;
        if (!sectionsMap.has(secName)) {
          const secRes = await client.query(
            `INSERT INTO template_sections (template_id, section_name, section_order)
             VALUES ($1, $2, $3)
             RETURNING section_id`,
            [templateId, secName, sectionOrder++]
          );
          sectionId = secRes.rows[0].section_id;
          sectionsMap.set(secName, sectionId);
          questionOrder = 1; // Reset question order for new section
        } else {
          sectionId = sectionsMap.get(secName)!;
        }

        // Insert Question
        await client.query(
          `INSERT INTO template_questions 
           (section_id, question_text, input_type, question_order)
           VALUES ($1, $2, $3, $4)`,
          [sectionId, qText, qType.toLowerCase(), questionOrder++]
        );
      }

      await client.query("COMMIT");

      // Cleanup uploaded file
      fs.unlinkSync(req.file.path);

      res.status(201).json({
        message: "Template imported successfully",
        template_id: templateId,
        template_name: templateName,
      });
    } catch (error: any) {
      await client.query("ROLLBACK");
      console.error("Error importing template:", error);
      // Cleanup file if error occurs
      if (req.file) fs.unlinkSync(req.file.path);
      res.status(500).json({ error: error.message });
    } finally {
      client.release();
    }
  }
);

export default router;
