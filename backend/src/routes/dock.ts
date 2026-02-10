
import { Router, Response } from 'express';
import pool from '../database/db';
import { AuthRequest } from '../types/index';
import { authenticateToken, authorizeRole } from '../middleware/auth';

const router = Router();

// GET /api/dock-plan - Get Dock Audit Plan
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { year } = req.query;
        const yearVal = year ? parseInt(year as string) : new Date().getFullYear();

        // 1. Fetch the stored plan
        const planResult = await pool.query(
            `SELECT * FROM dock_audit_plan WHERE year = $1 ORDER BY part_family, month`,
            [yearVal]
        );

        // 2. Fetch actual audits for this year that are 'Dock Audit'
        const actualResult = await pool.query(
            `SELECT a.audit_id, a.part_name, a.audit_date, a.status, t.template_name
             FROM audits a
             JOIN audit_templates t ON a.template_id = t.template_id
             WHERE t.template_name = 'Dock Audit'
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

// POST /api/dock-plan - Create/Update Plan Entry
router.post('/', authenticateToken, authorizeRole('Admin'), async (req: AuthRequest, res: Response) => {
    try {
        const { part_family, month, year, week, is_planned } = req.body;

        // Check if row exists
        let row = await pool.query(
            `SELECT id, week_${week}_audit_id FROM dock_audit_plan WHERE part_family = $1 AND month = $2 AND year = $3`,
            [part_family, month, year]
        );

        let planId;
        if (row.rows.length === 0) {
            const insert = await pool.query(
                `INSERT INTO dock_audit_plan (part_family, month, year) VALUES ($1, $2, $3) RETURNING id`,
                [part_family, month, year]
            );
            planId = insert.rows[0].id;
        } else {
            planId = row.rows[0].id;
        }

        const column = `week_${week}_plan`;

        // Update the plan table
        await pool.query(
            `UPDATE dock_audit_plan SET ${column} = $1 WHERE id = $2`,
            [is_planned, planId]
        );

        res.json({ message: 'Plan updated', auditId: null });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/dock-plan/link-audit - Link an Audit to a Plan Slot
router.post('/link-audit', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { part_family, month, year, week, audit_id } = req.body;

        const result = await pool.query(
            `UPDATE dock_audit_plan 
             SET week_${week}_audit_id = $1 
             WHERE part_family = $2 AND month = $3 AND year = $4
             RETURNING id`,
            [audit_id, part_family, month, year]
        );

        if (result.rowCount === 0) {
            // Maybe row doesn't exist? Create generic row?
            // Ideally plan should exist if we are auditing against it.
            // But let's insert if missing
            await pool.query(
                `INSERT INTO dock_audit_plan (part_family, month, year, week_${week}_audit_id) 
                 VALUES ($1, $2, $3, $4)`,
                [part_family, month, year, audit_id]
            );
        }

        res.json({ message: 'Audit linked to plan' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/dock-plan/products - Get list of products (part families)
router.get('/products', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const result = await pool.query(`SELECT product_name FROM dock_products ORDER BY product_name ASC`);
        res.json(result.rows.map(row => row.product_name));
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/dock-plan/products - Add a new product
router.post('/products', authenticateToken, authorizeRole('Admin'), async (req: AuthRequest, res: Response) => {
    try {
        const { product_name } = req.body;
        if (!product_name) return res.status(400).json({ error: 'Product name is required' });

        await pool.query(`INSERT INTO dock_products (product_name) VALUES ($1) ON CONFLICT (product_name) DO NOTHING`, [product_name]);
        res.json({ message: 'Product added' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/dock-plan/products/:name - Delete a product
router.delete('/products/:name', authenticateToken, authorizeRole('Admin'), async (req: AuthRequest, res: Response) => {
    try {
        const { name } = req.params;
        await pool.query(`DELETE FROM dock_products WHERE product_name = $1`, [name]);
        res.json({ message: 'Product deleted' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
