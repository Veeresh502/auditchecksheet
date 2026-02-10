
import { Router, Response } from 'express';
import pool from '../database/db';
import { AuthRequest } from '../types/index';
import { authenticateToken, authorizeRole } from '../middleware/auth';
import { sendNotification } from '../services/emailService';

const router = Router();

// GET /api/mfg-plan - Get Manufacturing Audit Plan
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { year } = req.query;
        const yearVal = year ? parseInt(year as string) : 2026;

        const planResult = await pool.query(
            `SELECT * FROM mfg_audit_plan WHERE year = $1 ORDER BY part_family, month`,
            [yearVal]
        );

        // Fetch actual audits for 'Manufacturing Process Audit' (adjust template name as needed)
        const actualResult = await pool.query(
            `SELECT a.audit_id, a.part_name, a.audit_date, a.status, t.template_name
             FROM audits a
             JOIN audit_templates t ON a.template_id = t.template_id
             WHERE t.template_name ILIKE '%Manufacturing%'
             AND EXTRACT(YEAR FROM a.audit_date) = $1`,
            [yearVal]
        );

        res.json({
            plan: planResult.rows,
            actuals: actualResult.rows
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/mfg-plan - Create/Update Plan Entry
router.post('/', authenticateToken, authorizeRole('Admin'), async (req: AuthRequest, res: Response) => {
    try {
        const { part_family, month, year, week, is_planned } = req.body;

        let row = await pool.query(
            `SELECT id, week_${week}_audit_id FROM mfg_audit_plan WHERE part_family = $1 AND month = $2 AND year = $3`,
            [part_family, month, year]
        );

        let planId;

        if (row.rows.length === 0) {
            const insert = await pool.query(
                `INSERT INTO mfg_audit_plan (part_family, month, year) VALUES ($1, $2, $3) RETURNING id`,
                [part_family, month, year]
            );
            planId = insert.rows[0].id;
        } else {
            planId = row.rows[0].id;
        }

        const column = `week_${week}_plan`;

        // Update the plan table (Independent toggling)
        await pool.query(
            `UPDATE mfg_audit_plan SET ${column} = $1 WHERE id = $2`,
            [is_planned, planId]
        );

        res.json({ message: 'Plan updated', auditId: null });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/mfg-plan/products - Get list of mfg products
router.get('/products', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const result = await pool.query(`SELECT product_name FROM mfg_products ORDER BY product_name ASC`);
        res.json(result.rows.map(row => row.product_name));
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/mfg-plan/products - Add a new mfg product
router.post('/products', authenticateToken, authorizeRole('Admin'), async (req: AuthRequest, res: Response) => {
    try {
        const { product_name } = req.body;
        if (!product_name) return res.status(400).json({ error: 'Product name is required' });

        await pool.query(`INSERT INTO mfg_products (product_name) VALUES ($1) ON CONFLICT (product_name) DO NOTHING`, [product_name]);
        res.json({ message: 'Product added' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/mfg-plan/products/:name - Delete a mfg product
router.delete('/products/:name', authenticateToken, authorizeRole('Admin'), async (req: AuthRequest, res: Response) => {
    try {
        const { name } = req.params;
        await pool.query(`DELETE FROM mfg_products WHERE product_name = $1`, [name]);
        res.json({ message: 'Product deleted' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
