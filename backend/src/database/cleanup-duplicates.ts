import pool from './db';

async function cleanup() {
    const client = await pool.connect();
    try {
        console.log('🧹 Starting robust cleanup of duplicate entries...');

        // Cleanup audit_objectives_log
        console.log('Cleaning audit_objectives_log...');
        await client.query(`
      DELETE FROM audit_objectives_log a
      WHERE objective_id IN (
        SELECT objective_id
        FROM (
          SELECT objective_id,
                 ROW_NUMBER() OVER (
                   PARTITION BY audit_id, COALESCE(objective_type, ''), parameter_name
                   ORDER BY recorded_at DESC, objective_id DESC
                 ) as row_num
          FROM audit_objectives_log
        ) t
        WHERE t.row_num > 1
      );
    `);

        // Cleanup audit_calibration_log
        console.log('Cleaning audit_calibration_log...');
        await client.query(`
      DELETE FROM audit_calibration_log a
      WHERE calibration_id IN (
        SELECT calibration_id
        FROM (
          SELECT calibration_id,
                 ROW_NUMBER() OVER (
                   PARTITION BY audit_id, instrument_name
                   ORDER BY recorded_at DESC, calibration_id DESC
                 ) as row_num
          FROM audit_calibration_log
        ) t
        WHERE t.row_num > 1
      );
    `);

        // Cleanup audit_parameter_log
        console.log('Cleaning audit_parameter_log...');
        await client.query(`
      DELETE FROM audit_parameter_log a
      WHERE parameter_id IN (
        SELECT parameter_id
        FROM (
          SELECT parameter_id,
                 ROW_NUMBER() OVER (
                   PARTITION BY audit_id, parameter_name
                   ORDER BY recorded_at DESC, parameter_id DESC
                 ) as row_num
          FROM audit_parameter_log
        ) t
        WHERE t.row_num > 1
      );
    `);

        console.log('✅ Robust cleanup completed successfully');
    } catch (error) {
        console.error('❌ Robust cleanup error:', error);
    } finally {
        client.release();
        process.exit();
    }
}

cleanup();
