import nodemailer from 'nodemailer';
import type { Transporter } from "nodemailer";
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM;
const SMTP_FROM_NAME = process.env.SMTP_FROM_NAME || 'Your Company';
const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

export function getTransporter(): ReturnType<typeof nodemailer.createTransport> {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: parseInt(process.env.SMTP_PORT || "587") === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  return transporter;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    const transporter = getTransporter();
    
    await transporter.sendMail({
      from: `"${SMTP_FROM_NAME}" <${SMTP_USER}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
    
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

export function generatePasswordResetEmailHtml(
  userName: string,
  resetToken: string,
  expiresInMinutes: number = 15
): string {
  const resetUrl = `${APP_BASE_URL}/reset-password?token=${resetToken}`;
  const currentYear = new Date().getFullYear();
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f4f4f5;
      padding: 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      font-size: 28px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .header p {
      color: rgba(255, 255, 255, 0.9);
      font-size: 16px;
    }
    .content {
      padding: 40px 30px;
    }
    .greeting {
      color: #1f2937;
      font-size: 18px;
      margin-bottom: 20px;
    }
    .message {
      color: #4b5563;
      font-size: 15px;
      line-height: 1.6;
      margin-bottom: 30px;
    }
    .button-container {
      text-align: center;
      margin-bottom: 30px;
    }
    .button {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #ffffff !important;
      text-decoration: none;
      padding: 16px 40px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .button:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }
    .fallback {
      color: #6b7280;
      font-size: 13px;
      margin-top: 20px;
      word-break: break-all;
    }
    .fallback a {
      color: #667eea;
      text-decoration: underline;
    }
    .expiry-notice {
      background-color: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 16px;
      margin: 24px 0;
      border-radius: 4px;
    }
    .expiry-notice p {
      color: #92400e;
      font-size: 14px;
      margin: 0;
    }
    .footer {
      background-color: #f9fafb;
      padding: 24px 30px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
    }
    .footer p {
      color: #9ca3af;
      font-size: 13px;
      margin: 0;
    }
    @media (max-width: 640px) {
      .container {
        border-radius: 0;
      }
      .header, .content, .footer {
        padding: 30px 20px;
      }
      .button {
        display: block;
        width: 100%;
        text-align: center;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Password Reset</h1>
      <p>Reset your account password</p>
    </div>
    
    <div class="content">
      <p class="greeting">Hello ${userName},</p>
      
      <p class="message">
        We received a request to reset your password. Click the button below to create a new password for your account.
      </p>
      
      <div class="button-container">
        <a href="${resetUrl}" class="button">Reset Password</a>
      </div>
      
      <div class="expiry-notice">
        <p><strong>Important:</strong> This link will expire in ${expiresInMinutes} minutes for security reasons.</p>
      </div>
      
      <p class="message">
        If you didn't request a password reset, please ignore this email. Your current password will remain unchanged.
      </p>
      
      <p class="fallback">
        If the button above doesn't work, copy and paste this link into your browser:<br>
        <a href="${resetUrl}">${resetUrl}</a>
      </p>
    </div>
    
    <div class="footer">
      <p>&copy; ${currentYear} Your Company Name. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;
}
