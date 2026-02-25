import nodemailer from 'nodemailer';

// Configure Transporter (Use your real credentials in .env)
let transporter: nodemailer.Transporter | null = null;

try {
  const isPlaceholder = (str?: string) =>
    !str ||
    str.includes('example') ||
    str.includes('your_') ||
    str === 'EMAIL_USER' ||
    str === 'EMAIL_PASS';

  if (process.env.EMAIL_USER && process.env.EMAIL_PASS && !isPlaceholder(process.env.EMAIL_USER) && !isPlaceholder(process.env.EMAIL_PASS)) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    // Verify connection on startup without crashing
    transporter.verify((error) => {
      if (error) {
        console.warn('⚠️ SMTP Authentication failed. Switching to mock mode.', error.message);
        transporter = null;
      } else {
        console.log('✅ SMTP connection established');
      }
    });
  } else {
    console.log('ℹ️ Email service in MOCK mode (no credentials provided)');
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