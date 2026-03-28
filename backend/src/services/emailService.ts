import nodemailer from 'nodemailer';
import sgMail from '@sendgrid/mail';

// Configuration
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

let useSendGrid = false;
let transporter: nodemailer.Transporter | null = null;

const isPlaceholder = (str?: string) =>
  !str ||
  str.includes('example') ||
  str.includes('your_') ||
  str === 'EMAIL_USER' ||
  str === 'EMAIL_PASS' ||
  str === 'SENDGRID_API_KEY';

// Initialize Service
try {
  if (SENDGRID_API_KEY && !isPlaceholder(SENDGRID_API_KEY)) {
    console.log('📧 initializing Email Service via SendGrid API...');
    sgMail.setApiKey(SENDGRID_API_KEY);
    useSendGrid = true;
    console.log('✅ SendGrid API ready');
  } else if (EMAIL_USER && EMAIL_PASS && !isPlaceholder(EMAIL_USER) && !isPlaceholder(EMAIL_PASS)) {
    console.log(`📧 Attempting to initialize SMTP for ${EMAIL_USER}...`);
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS.replace(/\s/g, ''),
      },
      logger: true,
      debug: true
    });

    transporter.verify((error) => {
      if (error) {
        console.warn('⚠️ SMTP Authentication failed. Error code:', (error as any).code);
        console.warn('⚠️ Error message:', error.message);
        console.warn('⚠️ Switching to mock mode.');
        transporter = null;
      } else {
        console.log('✅ SMTP connection established and ready');
      }
    });
  } else {
    console.log('ℹ️ Email service in MOCK mode (No valid credentials)');
  }
} catch (error) {
  console.warn('⚠️ Email service failed to initialize.', error);
}

export const sendNotification = async (to: string, subject: string, text: string, html?: string) => {
  try {
    const fromEmail = process.env.SENDGRID_FROM || EMAIL_USER || 'no-reply@dana-audit.com';
    
    const portalUrl = 'https://audit-frontend-d6tn.onrender.com';
    const portalTextStr = `\n\n---\nAccess the Audit Portal here: ${portalUrl}`;
    const portalHtmlStr = `<br><br><hr><p>Access the <a href="${portalUrl}">Audit Portal here</a>.</p>`;

    const msg = {
      to,
      from: fromEmail,
      subject,
      text: text + portalTextStr,
      html: (html || text.replace(/\n/g, '<br>')) + portalHtmlStr,
    };

    if (useSendGrid) {
      await sgMail.send(msg);
      console.log('📧 (SendGrid) Real Email sent to:', to);
      return;
    }

    if (transporter) {
      await transporter.sendMail(msg);
      console.log('📧 (SMTP) Real Email sent to:', to);
      return;
    }

    // Fallback: Mock Mode
    console.log('--- 📧 MOCK EMAIL SENT ---');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log('--------------------------');
  } catch (error: any) {
    console.error('❌ Email failed:', error.message);
    if (error.response) {
      console.error('SendGrid Error details:', JSON.stringify(error.response.body));
    }
  }
};

export const sendWelcomeEmail = async (email: string, password: string, role: string) => {
  const subject = `Welcome to the Dana Audit Management System`;
  const html = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #0d6efd;">Welcome to the Audit Portal!</h2>
      <p>Your account has been successfully created by the Administrator.</p>
      <p><strong>Your Assigned Role:</strong> ${role.replace('_', ' ')}</p>
      <br/>
      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; border-left: 4px solid #0d6efd;">
        <h3 style="margin-top: 0; color: #0d6efd;">Login Credentials</h3>
        <p style="margin-bottom: 5px;"><strong>Email:</strong> ${email}</p>
        <p style="margin-bottom: 0;"><strong>Password:</strong> ${password}</p>
      </div>
      <br/>
      <p>Please log in using the credentials above. We recommend keeping this email for your records.</p>
    </div>
  `;
  const text = `Welcome to the Audit Portal!\n\nYour account has been successfully created.\nRole: ${role.replace('_', ' ')}\n\nLogin Credentials\nEmail: ${email}\nPassword: ${password}\n\nPlease log in using the credentials above.`;

  await sendNotification(email, subject, text, html);
};