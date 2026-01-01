#!/usr/bin/env node

/**
 * Test email sending with Resend using verified domain
 * Run with: node test-email-send.js your-email@example.com
 */

require('dotenv').config({ path: '.env.local' });
const { Resend } = require('resend');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Run-Smart <noreply@runsmart-ai.com>';

// Get recipient email from command line or use default
const recipientEmail = process.argv[2] || 'nadav.yigal@gmail.com';

console.log('\n🧪 RESEND EMAIL TEST\n');
console.log('='.repeat(60));
console.log('Configuration:');
console.log('  API Key:', RESEND_API_KEY ? RESEND_API_KEY.substring(0, 10) + '...' : '❌ NOT SET');
console.log('  From Email:', FROM_EMAIL);
console.log('  To Email:', recipientEmail);
console.log('='.repeat(60));

async function testEmailSend() {
  if (!RESEND_API_KEY) {
    console.log('\n❌ RESEND_API_KEY is not set in .env.local');
    process.exit(1);
  }

  const resend = new Resend(RESEND_API_KEY);

  try {
    console.log('\n📤 Sending test email...\n');

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [recipientEmail],
      subject: '🧪 Test Email - Run-Smart Beta Signup',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Test Email</title>
          </head>
          <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h1 style="color: #667eea;">🧪 Test Email</h1>
            <p>This is a test email from Run-Smart to verify email configuration.</p>
            <p><strong>Configuration Details:</strong></p>
            <ul>
              <li>From: ${FROM_EMAIL}</li>
              <li>To: ${recipientEmail}</li>
              <li>Time: ${new Date().toLocaleString()}</li>
            </ul>
            <p style="color: #10b981; font-weight: bold;">✅ If you receive this, email sending is working!</p>
          </body>
        </html>
      `,
      text: `
TEST EMAIL - Run-Smart

This is a test email from Run-Smart to verify email configuration.

Configuration:
- From: ${FROM_EMAIL}
- To: ${recipientEmail}
- Time: ${new Date().toLocaleString()}

✅ If you receive this, email sending is working!
      `,
    });

    if (error) {
      console.log('❌ ERROR sending email:');
      console.log('   Status:', error.statusCode);
      console.log('   Name:', error.name);
      console.log('   Message:', error.message);
      console.log('\nFull error object:');
      console.log(JSON.stringify(error, null, 2));

      if (error.message && error.message.includes('gmail.com')) {
        console.log('\n🔧 FIX NEEDED:');
        console.log('   Cannot send from @gmail.com addresses.');
        console.log('   Update RESEND_FROM_EMAIL to use your verified domain:');
        console.log('   RESEND_FROM_EMAIL=Run-Smart <noreply@runsmart-ai.com>');
      }

      if (error.message && error.message.includes('sandbox')) {
        console.log('\n🔧 FIX NEEDED:');
        console.log('   Sandbox mode only allows sending to your account email.');
        console.log('   To send to other emails, verify your domain in Resend dashboard:');
        console.log('   https://resend.com/domains');
      }

      process.exit(1);
    }

    console.log('✅ EMAIL SENT SUCCESSFULLY!\n');
    console.log('Email ID:', data.id);
    console.log('\n📧 Check your inbox at:', recipientEmail);
    console.log('   (Also check spam/promotions folder)\n');
    console.log('🔗 View in Resend dashboard:');
    console.log('   https://resend.com/emails/' + data.id);
    console.log('\n' + '='.repeat(60));

  } catch (error) {
    console.log('❌ UNEXPECTED ERROR:');
    console.log('   ', error.message);
    console.log('\nStack trace:');
    console.log(error.stack);
    process.exit(1);
  }
}

testEmailSend();
