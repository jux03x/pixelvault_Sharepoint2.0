import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465',
    auth: process.env.SMTP_USER ? {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    } : undefined,
  });
}

export async function sendMagicLinkEmail(to: string, magicLink: string): Promise<void> {
  const transporter = createTransport();
  const appTitle = 'PixelVault';

  await transporter.sendMail({
    from: process.env.SMTP_FROM || `${appTitle} <noreply@pixelvault.app>`,
    to,
    subject: `Your ${appTitle} Login Link`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#fafafa;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 20px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#0a0a0a;padding:32px;text-align:center;">
              <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;letter-spacing:-0.5px;">📸 ${appTitle}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h2 style="color:#0a0a0a;margin:0 0 12px;font-size:20px;font-weight:600;">Your login link</h2>
              <p style="color:#666;margin:0 0 32px;font-size:15px;line-height:1.6;">
                Click the button below to sign in. This link expires in 15 minutes.
              </p>
              <a href="${magicLink}" 
                 style="display:inline-block;background:#007AFF;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:600;letter-spacing:-0.2px;">
                Sign in to ${appTitle}
              </a>
              <p style="color:#999;margin:32px 0 0;font-size:13px;">
                If you didn't request this link, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    text: `Your ${appTitle} login link: ${magicLink}\n\nThis link expires in 15 minutes.`,
  });

  logger.info(`Magic link email sent to ${to}`);
}
