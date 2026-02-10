import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import path from 'path';

// Load .env from the root of backend
dotenv.config({ path: path.join(__dirname, '../../.env') });

const testEmail = async () => {
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;

    console.log('🔍 Testing Email Configuration...');
    console.log(`📧 User: ${user || 'NOT SET'}`);
    console.log(`🔑 Pass: ${pass ? '******** (Hidden)' : 'NOT SET'}`);

    if (!user || !pass) {
        console.error('❌ Error: EMAIL_USER or EMAIL_PASS missing in .env');
        process.exit(1);
    }

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass }
    });

    try {
        console.log('⏳ Attempting to connect to SMTP server...');
        await transporter.verify();
        console.log('✅ SMTP Connection Verified Successfully!');

        console.log(`⏳ Sending test email to ${user}...`);
        const info = await transporter.sendMail({
            from: `"DANA Test" <${user}>`,
            to: user,
            subject: "DANA Audit System - SMTP Test",
            text: "If you received this, your local email notification system is working perfectly!",
            html: "<b>Success!</b><br>Your local email notification system is working perfectly."
        });

        console.log('✅ Test Email Sent!');
        console.log('🔗 Message ID:', info.messageId);
        console.log('\n✨ All systems go! You can now use the app with working notifications.');
    } catch (error) {
        console.error('❌ Email Test Failed!');
        console.error(error);
    }
};

testEmail();
