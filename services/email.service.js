const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
  }

  async initialize() {
    if (this.transporter) return;

    // ✅ Configuration check
    console.log("📧 SMTP Config:", {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS ? "✅ Set" : "❌ Missing"
    });

    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false, // 587 ke liye false
      auth: {
        user: process.env.SMTP_USER, 
        pass: process.env.SMTP_PASS, 
      },
      debug: true, // Debug on
      logger: true, // Logging on
    });

    // Verify connection
    try {
      await this.transporter.verify();
      console.log("✅ SMTP connection verified");
    } catch (error) {
      console.error("❌ SMTP connection failed:", error);
    }
  }

  async sendOTPEmail(to, otp, userName) {
    try {
      await this.initialize();

      const mailOptions = {
        from: `"The Nestory LMS" <${process.env.SMTP_FROM || 'info@thenestory.in'}>`,
        to,
        subject: 'Password Reset OTP - The Nestory LMS',
        html: this.getOTPEmailTemplate(otp, userName),
        text: `Your OTP for password reset is: ${otp}. It will expire in 10 minutes.`
      };

      console.log("📧 Sending email to:", to);
      
      const info = await this.transporter.sendMail(mailOptions);
      console.log("✅ Email sent:", info.messageId);
      
      // Ethereal URL for testing (agar development mein ho)
      if (process.env.NODE_ENV !== 'production') {
        console.log("📧 Preview URL:", nodemailer.getTestMessageUrl(info));
      }
      
      return info;
    } catch (error) {
      console.error("❌ Email sending failed:", error);
      throw error;
    }
  }

  getOTPEmailTemplate(otp, userName) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Password Reset OTP</title>
      </head>
      <body>
        <h2>Hello ${userName || 'User'},</h2>
        <p>Your OTP for password reset is:</p>
        <h1 style="font-size: 32px; letter-spacing: 5px; color: #667eea;">${otp}</h1>
        <p>This OTP will expire in 10 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
      </body>
      </html>
    `;
  }
}

module.exports = new EmailService();