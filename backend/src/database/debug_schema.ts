
import pool from './db';

async function checkSchema() {
    try {
        const res = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'mfg_audit_plan';
    `);
        console.log('Columns in mfg_audit_plan:', res.rows.map(r => r.column_name));
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

checkSchema();
