import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: 'process.dockaudit@gmail.com',
    pass: 'fevbootykbonsxey', // The app password from the user's .env
  },
});

transporter.sendMail({
  from: 'process.dockaudit@gmail.com',
  to: 'process.dockaudit@gmail.com',
  subject: 'Test Local SMTP Send',
  text: 'Hello from Node script. Did this arrive?'
}).then((info) => {
  console.log('✅ Sent successfully!', info.response);
}).catch((err) => {
  console.log('❌ Failed!', err.message);
});
