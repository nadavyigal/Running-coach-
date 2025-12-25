import { Resend } from 'resend';

// Initialize Resend with API key from environment variables
const resend = new Resend(process.env.RESEND_API_KEY);

// Configuration
const DEFAULT_FROM_EMAIL = 'runsmartteam@gmail.com';
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL?.trim() || DEFAULT_FROM_EMAIL;
const DOMAIN = 'runsmart-ai.com';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send an email using Resend
 */
export async function sendEmail({ to, subject, html, text }: EmailOptions) {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text,
    });

    if (error) {
      console.error('Error sending email:', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }

    return { success: true, data };
  } catch (error) {
    console.error('Email sending failed:', error);
    throw error;
  }
}

/**
 * Send a welcome email to a new user
 */
export async function sendWelcomeEmail(email: string, name?: string) {
  const displayName = name || 'Runner';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Run-Smart</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; max-width: 100%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <!-- Header -->
                <tr>
                  <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: bold;">🏃‍♂️ Run-Smart</h1>
                  </td>
                </tr>

                <!-- Content -->
                <tr>
                  <td style="padding: 40px;">
                    <h2 style="margin: 0 0 20px; color: #1a1a1a; font-size: 24px;">Welcome, ${displayName}!</h2>

                    <p style="margin: 0 0 16px; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                      Thank you for joining Run-Smart, your AI-powered running coach. We're excited to help you achieve your running goals!
                    </p>

                    <p style="margin: 0 0 16px; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                      Here's what you can do with Run-Smart:
                    </p>

                    <ul style="margin: 0 0 24px; padding-left: 20px; color: #4a4a4a; font-size: 16px; line-height: 1.8;">
                      <li>Get personalized training plans tailored to your fitness level</li>
                      <li>Track your runs with GPS and detailed metrics</li>
                      <li>Monitor your recovery and health data</li>
                      <li>Chat with your AI running coach for advice and motivation</li>
                      <li>Join a supportive community of runners</li>
                    </ul>

                    <div style="text-align: center; margin: 32px 0;">
                      <a href="https://${DOMAIN}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                        Start Your Journey
                      </a>
                    </div>

                    <p style="margin: 24px 0 0; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                      If you have any questions, just reply to this email. We're here to help!
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="padding: 20px 40px; background-color: #f9f9f9; border-radius: 0 0 8px 8px; text-align: center;">
                    <p style="margin: 0; color: #888888; font-size: 14px;">
                      Run-Smart AI Running Coach<br>
                      <a href="https://${DOMAIN}" style="color: #667eea; text-decoration: none;">${DOMAIN}</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  const text = `
Welcome to Run-Smart, ${displayName}!

Thank you for joining Run-Smart, your AI-powered running coach. We're excited to help you achieve your running goals!

Here's what you can do with Run-Smart:
- Get personalized training plans tailored to your fitness level
- Track your runs with GPS and detailed metrics
- Monitor your recovery and health data
- Chat with your AI running coach for advice and motivation
- Join a supportive community of runners

Start Your Journey: https://${DOMAIN}

If you have any questions, just reply to this email. We're here to help!

Run-Smart AI Running Coach
${DOMAIN}
  `;

  return sendEmail({
    to: email,
    subject: 'Welcome to Run-Smart - Your AI Running Coach',
    html,
    text,
  });
}

/**
 * Send a beta waitlist confirmation email
 */
export async function sendBetaWaitlistEmail(email: string, name?: string) {
  const displayName = name || 'there';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>You're on the Run-Smart Beta Waitlist!</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; max-width: 100%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <!-- Header -->
                <tr>
                  <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: bold;">🎉 You're In!</h1>
                  </td>
                </tr>

                <!-- Content -->
                <tr>
                  <td style="padding: 40px;">
                    <h2 style="margin: 0 0 20px; color: #1a1a1a; font-size: 24px;">Hi ${displayName},</h2>

                    <p style="margin: 0 0 16px; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                      Thank you for your interest in Run-Smart! You've been successfully added to our beta waitlist.
                    </p>

                    <div style="background-color: #f0f4ff; padding: 20px; border-radius: 6px; margin: 24px 0;">
                      <p style="margin: 0; color: #667eea; font-size: 18px; font-weight: 600; text-align: center;">
                        ✨ You're among the first to experience the future of running coaching
                      </p>
                    </div>

                    <p style="margin: 0 0 16px; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                      <strong>What happens next?</strong>
                    </p>

                    <ol style="margin: 0 0 24px; padding-left: 20px; color: #4a4a4a; font-size: 16px; line-height: 1.8;">
                      <li>We'll notify you as soon as beta spots become available</li>
                      <li>You'll get early access to all premium features</li>
                      <li>Your feedback will help shape the future of Run-Smart</li>
                      <li>Exclusive perks for being an early supporter</li>
                    </ol>

                    <p style="margin: 0 0 16px; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                      In the meantime, follow us on social media to stay updated on our progress and get running tips from our AI coach.
                    </p>

                    <div style="text-align: center; margin: 32px 0;">
                      <p style="margin: 0 0 16px; color: #888888; font-size: 14px;">
                        Share Run-Smart with fellow runners to move up the waitlist!
                      </p>
                    </div>

                    <p style="margin: 24px 0 0; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                      Questions? Just reply to this email - we'd love to hear from you!
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="padding: 20px 40px; background-color: #f9f9f9; border-radius: 0 0 8px 8px; text-align: center;">
                    <p style="margin: 0 0 12px; color: #888888; font-size: 14px;">
                      Run-Smart AI Running Coach<br>
                      <a href="https://${DOMAIN}" style="color: #667eea; text-decoration: none;">${DOMAIN}</a>
                    </p>
                    <p style="margin: 0; color: #aaaaaa; font-size: 12px;">
                      You're receiving this email because you signed up for the Run-Smart beta waitlist.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  const text = `
You're on the Run-Smart Beta Waitlist!

Hi ${displayName},

Thank you for your interest in Run-Smart! You've been successfully added to our beta waitlist.

✨ You're among the first to experience the future of running coaching

What happens next?
1. We'll notify you as soon as beta spots become available
2. You'll get early access to all premium features
3. Your feedback will help shape the future of Run-Smart
4. Exclusive perks for being an early supporter

In the meantime, follow us on social media to stay updated on our progress and get running tips from our AI coach.

Share Run-Smart with fellow runners to move up the waitlist!

Questions? Just reply to this email - we'd love to hear from you!

Run-Smart AI Running Coach
${DOMAIN}

You're receiving this email because you signed up for the Run-Smart beta waitlist.
  `;

  return sendEmail({
    to: email,
    subject: "You're on the Run-Smart Beta Waitlist! 🎉",
    html,
    text,
  });
}
