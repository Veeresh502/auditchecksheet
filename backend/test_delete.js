import pg from 'pg';

const pool = new pg.Pool({ connectionString: 'postgresql://postgres:user@localhost:5433/ddams_db' });

async function check() {
  try {
    const email = '01fe23bcs002@kletech.ac.in'; // Target "Owner" user from the screenshot
    const userRes = await pool.query(`SELECT user_id FROM users WHERE email=$1`, [email]);
    if (userRes.rows.length === 0) {
       console.log("User not found in DB.");
       return;
    }
    const userId = userRes.rows[0].user_id;
    console.log("User ID:", userId);

    const auditsRes = await pool.query(`SELECT audit_id FROM audits WHERE l1_auditor_id=$1 OR l2_auditor_id=$1 OR process_owner_id=$1`, [userId]);
    console.log("Associated Audits:", auditsRes.rows.length);

    try {
        await pool.query(`DELETE FROM users WHERE user_id=$1`, [userId]);
        console.log("Deletion successful.");
    } catch(err) {
        console.log("Deletion failed!");
        console.log("Error message:", err.message);
        console.log("Error code:", err.code);
        console.log("Error constraint:", err.constraint);
    }
  } catch(e) {
    console.log("Setup Error:", e.message);
  } finally {
    pool.end();
  }
}
check();
