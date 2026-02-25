import pool from './db';

async function listConstraints() {
    const client = await pool.connect();
    try {
        const res = await client.query(`
      SELECT 
        conname as constraint_name, 
        pg_get_constraintdef(c.oid) as definition
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE t.relname = 'audit_objectives_log';
    `);
        console.log('--- Constraints on audit_objectives_log ---');
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (error) {
        console.error('Error listing constraints:', error);
    } finally {
        client.release();
        process.exit();
    }
}

listConstraints();
