import nodemailer from 'nodemailer';

// Configure Transporter (Use your real credentials in .env)
let transporter: nodemailer.Transporter | null = null;

try {
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS && !process.env.EMAIL_USER.includes('example')) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }
} catch (error) {
  console.warn('⚠️ Email service failed to initialize. Falling back to mock mode.', error);
  transporter = null;
}

export const sendNotification = async (to: string, subject: string, text: string, html?: string) => {
  try {
    // If credentials are missing, we just log the email to console (Development Mode)
    if (!transporter) {
      console.log('--- 📧 MOCK EMAIL SENT (Log Only) ---');
      console.log(`To: ${to}`);
      console.log(`Subject: ${subject}`);
      console.log(`Body: ${text}`);
      console.log('------------------------------------');
      return;
    }

    const mailOptions = {
      from: `"DANA Audit System" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html: html || text.replace(/\n/g, '<br>'),
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('📧 Real Email sent: %s', info.messageId);
  } catch (error) {
    console.error('❌ Email failed:', error);
  }
};