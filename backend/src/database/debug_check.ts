
import pool from './db';

async function checkData() {
    try {
        console.log('--- CHECKING USERS ---');
        const users = await pool.query("SELECT user_id, full_name, role FROM users WHERE role = 'L1_Auditor'");
        console.log('L1 Auditors:', users.rows);

        console.log('\n--- CHECKING TEMPLATES ---');
        const templates = await pool.query("SELECT template_id, template_name FROM audit_templates WHERE template_name ILIKE '%Manufacturing%'");
        console.log('Mfg Templates:', templates.rows);

        console.log('\n--- CHECKING AUDITS ---');
        const audits = await pool.query("SELECT audit_id, machine_name, l1_auditor_id, created_at FROM audits ORDER BY created_at DESC LIMIT 5");
        console.log('Recent Audits:', audits.rows);

    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

checkData();
