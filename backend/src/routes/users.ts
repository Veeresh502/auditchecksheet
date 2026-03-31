import { Router, Response } from 'express'
import pool from '../database/db'
import bcrypt from 'bcryptjs'
import { AuthRequest } from '../types/index'
import { authenticateToken } from '../middleware/auth'
import { sendWelcomeEmail } from '../services/emailService'

const router = Router()

// ============================================================================
// USER MANAGEMENT ENDPOINTS (Admin only)
// ============================================================================

// GET /api/users - List all users
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'Admin') {
      res.status(403).json({ error: 'Only admins can view users' })
      return
    }

    const { role } = req.query;
    let query = `SELECT user_id, email, full_name, role, created_at, updated_at FROM users`;
    const params: any[] = [];

    if (role) {
      query += ` WHERE role = $1`;
      params.push(role);
    }

    query += ` ORDER BY created_at DESC`;
    const result = await pool.query(query, params);

    res.json(result.rows)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// POST /api/users - Create a new user (Restricted to Kripa Biju)
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    // SECURITY: Only Admins can manage members
    if (req.user?.role !== 'Admin') {
      res.status(403).json({ error: 'Master Access Required: Only Admins can add new members' })
      return
    }

    const { email, full_name, password, role } = req.body

    if (!email || !full_name || !password || !role) {
      res.status(400).json({ error: 'Missing required fields' })
      return
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const result = await pool.query(
      `INSERT INTO users (email, full_name, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING user_id, email, full_name, role, created_at`,
      [email.toLowerCase(), full_name, hashedPassword, role]
    )

    // Send welcome email with credentials
    sendWelcomeEmail(email.toLowerCase(), password, role).catch(err => {
      console.error('Failed to send welcome email to ' + email, err.message)
    });

    res.status(201).json(result.rows[0])
  } catch (error: any) {
    if (error.code === '23505') {
      res.status(400).json({ error: 'Email already exists' })
    } else {
      res.status(500).json({ error: error.message })
    }
  }
})

// PUT /api/users/:id/role - Update user role (Restricted to Kripa Biju)
router.put('/:id/role', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    // SECURITY: Only Admins can manage roles
    if (req.user?.role !== 'Admin') {
      res.status(403).json({ error: 'Master Access Required: Only Admins can modify roles' })
      return
    }

    const { id } = req.params;
    const { role } = req.body;

    if (!role) {
      res.status(400).json({ error: 'Role is required' });
      return;
    }

    const result = await pool.query(
      `UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 RETURNING user_id, email, role`,
      [role, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/users/:id - Update user details (Admin only)
router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'Admin') {
      res.status(403).json({ error: 'Master Access Required: Only Admins can modify members' })
      return
    }

    const { id } = req.params;
    const { email, full_name, role, password } = req.body;

    if (!email || !full_name || !role) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    let result;
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      result = await pool.query(
        `UPDATE users SET email = $1, full_name = $2, role = $3, password_hash = $4, updated_at = CURRENT_TIMESTAMP WHERE user_id = $5 RETURNING user_id, email, full_name, role`,
        [email.toLowerCase(), full_name, role, hashedPassword, id]
      );
    } else {
      result = await pool.query(
        `UPDATE users SET email = $1, full_name = $2, role = $3, updated_at = CURRENT_TIMESTAMP WHERE user_id = $4 RETURNING user_id, email, full_name, role`,
        [email.toLowerCase(), full_name, role, id]
      );
    }

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    if (error.code === '23505') {
      res.status(400).json({ error: 'Email already exists' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// DELETE /api/users/:id - Delete a user (Restricted to Kripa Biju)
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    // SECURITY: Only Admins can manage members
    if (req.user?.role !== 'Admin') {
      res.status(403).json({ error: 'Master Access Required: Only Admins can delete members' })
      return
    }

    const { id } = req.params

    const result = await pool.query(
      `DELETE FROM users WHERE user_id = $1 RETURNING user_id`,
      [id]
    )

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    res.json({ message: 'User deleted successfully' })
  } catch (error: any) {
    if (error.code === '23503') {
      res.status(400).json({ error: 'Cannot delete user: They are assigned to one or more audits.' })
      return
    }
    res.status(500).json({ error: error.message })
  }
})

export default router
