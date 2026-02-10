
import pool from './db';

async function inspectDatabase() {
    try {
        console.log('--- TABLES ---');
        const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
        console.log(tables.rows.map(r => r.table_name));
        const ddamsTables = [
            'users', 'audit_templates', 'template_sections', 'template_questions',
            'audits', 'audit_checklist_answers', 'audit_objectives_log',
            'audit_calibration_log', 'audit_parameter_log', 'non_conformances',
            'audit_logs', 'dock_products', 'dock_audit_plan', 'mfg_products',
            'mfg_audit_plan', 'pg_stat_statements' // pg_stat_statements is internal
        ];

        const strayTables = tables.rows
            .map(r => r.table_name)
            .filter(name => !ddamsTables.includes(name));

        if (strayTables.length > 0) {
            console.log('\n--- STRAY TABLES FOUND ---');
            console.log(strayTables);
        } else {
            console.log('\n--- NO STRAY TABLES FOUND ---');
        }

        // Also check for columns in 'audits' that might be "extra"
        console.log('\n--- CHECKING AUDITS COLUMNS ---');
        const auditCols = await pool.query(`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'audits'
    `);
        console.log(auditCols.rows.map(r => r.column_name));

        for (const table of tables.rows) {
            console.log(`\n--- COLUMNS IN ${table.table_name} ---`);
            const columns = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = $1
      `, [table.table_name.table_name || table.table_name]);
            console.log(columns.rows);
        }
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

inspectDatabase();
