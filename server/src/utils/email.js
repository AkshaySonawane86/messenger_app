

// server/src/utils/email.js

import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 465;
const SMTP_SECURE = process.env.SMTP_SECURE
  ? process.env.SMTP_SECURE === "true"
  : true;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const FROM_NAME = process.env.FROM_NAME || "Messenger App";
const FROM_EMAIL = process.env.FROM_EMAIL || SMTP_USER;

// ✅ Warn once if credentials missing
if (!SMTP_USER || !SMTP_PASS) {
  console.warn("⚠️ SMTP_USER or SMTP_PASS not set. Email sending will fail.");
}

// ✅ Create transporter
export const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_SECURE,
  auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
});

// ✅ Test transporter on startup (optional for debugging)
transporter.verify(function (error, success) {
  if (error) {
    console.error("❌ SMTP connection failed:", error.message);
  } else {
    console.log("✅ SMTP server ready to send emails");
  }
});

export async function sendOtpEmail(toEmail, code) {
  // ✅ Fallback: if no SMTP credentials, just log OTP to console for testing
  if (!SMTP_USER || !SMTP_PASS) {
    console.log(`📩 Mock OTP for ${toEmail}: ${code}`);
    return { mock: true };
  }

  const subject = `${FROM_NAME} — Your login code`;
  const text = `Your login code is: ${code}. It expires in 10 minutes. If you didn't request this, ignore this email.`;
  const html = `<p>Your login code is: <b style="font-size:18px">${code}</b></p><p>It expires in 10 minutes.</p>`;

  try {
    const info = await transporter.sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to: toEmail,
      subject,
      text,
      html,
    });
    console.log(`📧 OTP email sent to ${toEmail}`);
    return info;
  } catch (err) {
    console.error("❌ sendOtpEmail error:", err.message);
    throw err;
  }
}
