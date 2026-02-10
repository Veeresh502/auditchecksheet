import cron from 'node-cron';
import pool from '../database/db';
import { sendNotification } from './emailService';

export const initScheduler = () => {
    console.log('⏰ Scheduler initialized');

    // Run on the 1st day of every month at 09:00 AM
    // Format: 'minute hour day-of-month month day-of-week'
    cron.schedule('0 9 1 * *', async () => {
        console.log('🔄 Running monthly audit plan reminder...');

        try {
            const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const now = new Date();
            const currentMonth = monthNames[now.getMonth()];
            const currentYear = now.getFullYear();

            // Get all Admins
            const adminRes = await pool.query(`SELECT email, full_name FROM users WHERE role = 'Admin'`);

            if (adminRes.rows.length === 0) return;

            for (const admin of adminRes.rows) {
                await sendNotification(
                    admin.email,
                    `Action Required: Schedule Audits for ${currentMonth} ${currentYear}`,
                    `Hello ${admin.full_name},\n\nA new month has started. Please log in to the Admin Dashboard to review the Manufacturing and Dock Audit plans for ${currentMonth} ${currentYear} and schedule the necessary audits.\n\n- DANA Audit System`,
                    `<h2>Monthly Audit Planning Reminder</h2>
           <p>Hello ${admin.full_name},</p>
           <p>A new month has started. Please log in to the Admin Dashboard to review the <b>Manufacturing</b> and <b>Dock Audit</b> plans for <b>${currentMonth} ${currentYear}</b> and schedule the necessary audits.</p>
           <br>
           <p>- DANA Audit System</p>`
                );
            }

            console.log('✅ Monthly audit plan reminders sent to all Admins');
        } catch (error) {
            console.error('❌ Scheduler error:', error);
        }
    });
    // 2. Admin Follow-up: Run on the 3rd of every month at 09:00 AM (If plans are empty - simplified to generic reminder for now)
    cron.schedule('0 9 3 * *', async () => {
        console.log('🔄 Running Admin follow-up reminder...');
        try {
            const now = new Date();
            const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const currentMonth = monthNames[now.getMonth()];

            // Get all Admins
            const adminRes = await pool.query(`SELECT email, full_name FROM users WHERE role = 'Admin'`);
            for (const admin of adminRes.rows) {
                await sendNotification(
                    admin.email,
                    `Follow-up: Audit Scheduling for ${currentMonth}`,
                    `Hello ${admin.full_name},\n\nThis is a gentle reminder to ensure that the Manufacturing and Dock Audit plans for ${currentMonth} have been finalized and audits are scheduled.\n\n- DANA Audit System`
                );
            }
        } catch (error) {
            console.error('❌ Admin follow-up error:', error);
        }
    });

    // 3. L1 Reminder: Run daily at 08:00 AM to check for audits due in 3 days
    cron.schedule('0 8 * * *', async () => {
        console.log('🔄 Running L1 3-day upcoming audit check...');
        try {
            // Find audits due in 3 days that are not completed
            const upcomingAudits = await pool.query(
                `SELECT a.audit_id, a.machine_name, a.audit_date, u.email, u.full_name 
                 FROM audits a
                 JOIN users u ON a.l1_auditor_id = u.user_id
                 WHERE a.status NOT IN ('Completed', 'Submitted_to_L2', 'Rejected') 
                 AND a.audit_date = CURRENT_DATE + INTERVAL '3 days'`
            );

            if (upcomingAudits.rows.length > 0) {
                console.log(`Found ${upcomingAudits.rows.length} upcoming audits due in 3 days.`);
                for (const audit of upcomingAudits.rows) {
                    await sendNotification(
                        audit.email,
                        `Reminder: Audit Upcoming for ${audit.machine_name}`,
                        `Hello ${audit.full_name},\n\nThis is a reminder that you have an audit scheduled for ${audit.machine_name} in 3 days (${new Date(audit.audit_date).toDateString()}).\n\nPlease ensure you are prepared.\n\n- DANA Audit System`
                    );
                }
            }
        } catch (error) {
            console.error('❌ L1 reminder error:', error);
        }
    });
};
