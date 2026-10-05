# Resend Email Service Setup for Run-Smart

This document describes the complete Resend email integration for the Run-Smart application.

## Overview

Run-Smart uses [Resend](https://resend.com) as its transactional email service. Resend provides:
- Simple API for sending emails
- Beautiful email templates
- High deliverability rates
- Developer-friendly integration

## Configuration

### Environment Variables

The Resend API key is stored in `v0/.env.local`:

```env
RESEND_API_KEY=re_efPcCWBq_LuXJazpP7wewtJusRxcJNV1a
```

### Email Settings

- **From Email**: runsmartteam@gmail.com
- **Domain**: runsmart-ai.com
- **Service**: Resend

## File Structure

```
v0/
├── lib/
│   ├── email.ts              # Core email service utilities
│   └── email-examples.ts     # Usage examples and integration guides
└── app/
    └── api/
        └── email/
            └── send/
                └── route.ts  # API endpoint for sending emails
```

## Available Email Templates

### 1. Welcome Email

Sent to new users after they complete onboarding.

**Features:**
- Personalized greeting with user's name
- Overview of Run-Smart features
- Call-to-action button to start using the app
- Responsive HTML design with fallback text version

**Usage:**
```typescript
import { sendWelcomeEmail } from '@/lib/email';

await sendWelcomeEmail('user@example.com', 'John Doe');
```

### 2. Beta Waitlist Confirmation

Sent when users join the beta waitlist.

**Features:**
- Confirmation of waitlist signup
- Explanation of next steps
- Encouragement to share with others
- Responsive HTML design with fallback text version

**Usage:**
```typescript
import { sendBetaWaitlistEmail } from '@/lib/email';

await sendBetaWaitlistEmail('user@example.com', 'Jane Smith');
```

## API Endpoint

### POST /api/email/send

Send emails via HTTP request.

**Request Body:**
```json
{
  "type": "welcome" | "beta-waitlist",
  "email": "user@example.com",
  "name": "User Name" // optional
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "welcome email sent successfully",
  "data": {
    "id": "email-id-from-resend"
  }
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Error message"
}
```

**Status Codes:**
- `200`: Email sent successfully
- `400`: Invalid request (missing fields, invalid email format, invalid type)
- `500`: Server error (Resend API failure, network issues)

## Integration Examples

### Example 1: Send Welcome Email After Onboarding

Add this to your `OnboardingScreen.tsx` component:

```typescript
import { sendUserWelcomeEmail } from '@/lib/email-examples';

const handleOnboardingComplete = async (userData: User) => {
  try {
    // Save user to database
    await db.users.add(userData);

    // Send welcome email (non-blocking)
    sendUserWelcomeEmail(userData.email, userData.name)
      .catch(error => console.error('Failed to send welcome email:', error));

    // Continue with app flow
    setCurrentScreen('today');
  } catch (error) {
    console.error('Error completing onboarding:', error);
  }
};
```

### Example 2: Beta Waitlist Form Component

```tsx
'use client';

import { useState } from 'react';
import { sendBetaWaitlistConfirmation } from '@/lib/email-examples';

export function BetaWaitlistForm() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');

    try {
      await sendBetaWaitlistConfirmation(email, name);
      setStatus('success');
      setEmail('');
      setName('');
    } catch (error) {
      setStatus('error');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Your Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        type="email"
        placeholder="Your Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <button type="submit" disabled={status === 'loading'}>
        {status === 'loading' ? 'Joining...' : 'Join Waitlist'}
      </button>
    </form>
  );
}
```

### Example 3: Server-Side Email Sending

For sending emails directly from API routes or server components:

```typescript
import { sendWelcomeEmail } from '@/lib/email';

export async function POST(request: Request) {
  const { email, name } = await request.json();

  try {
    const result = await sendWelcomeEmail(email, name);
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
```

## Testing

### Local Testing

1. Ensure your `.env.local` file has the correct `RESEND_API_KEY`
2. Start the development server: `npm run dev`
3. Test the email endpoint:

```bash
curl -X POST http://localhost:3000/api/email/send \
  -H "Content-Type: application/json" \
  -d '{
    "type": "welcome",
    "email": "your-email@example.com",
    "name": "Test User"
  }'
```

4. Check your email inbox for the welcome email

### Testing Different Email Types

```bash
# Test Welcome Email
curl -X POST http://localhost:3000/api/email/send \
  -H "Content-Type: application/json" \
  -d '{"type": "welcome", "email": "test@example.com", "name": "John"}'

# Test Beta Waitlist Email
curl -X POST http://localhost:3000/api/email/send \
  -H "Content-Type: application/json" \
  -d '{"type": "beta-waitlist", "email": "test@example.com", "name": "Jane"}'
```

## Best Practices

1. **Non-Blocking**: Send emails asynchronously without blocking user flow
2. **Error Handling**: Email failures shouldn't crash your app
3. **Validation**: Always validate email addresses before sending
4. **Rate Limiting**: Consider implementing rate limits for public endpoints
5. **Logging**: Log email sends for debugging and analytics
6. **Security**: Never commit API keys to version control
7. **Fallback**: Provide plain text versions of all HTML emails

## Troubleshooting

### Email not being sent

1. **Check API Key**: Ensure `RESEND_API_KEY` is set in `.env.local`
2. **Check Console**: Look for error messages in server logs
3. **Verify Domain**: Ensure the domain is verified in Resend dashboard
4. **Check Email Format**: Validate email address format

### Email going to spam

1. **Verify Domain**: Set up SPF, DKIM, and DMARC records in Resend
2. **From Email**: Use a verified domain email address
3. **Content**: Avoid spam trigger words in email content

### API Errors

- **400 Bad Request**: Check request body format and required fields
- **500 Internal Server Error**: Check Resend API key and service status
- **Rate Limiting**: Check if you've exceeded Resend's rate limits

## Future Enhancements

Consider adding these email types:

1. **Password Reset**: For account recovery
2. **Run Completion**: Congratulate users after completing a run
3. **Weekly Summary**: Send weekly progress reports
4. **Achievement Unlocked**: Notify users when they earn badges
5. **Plan Completion**: Celebrate training plan completion
6. **Reminder Emails**: Remind users about upcoming workouts
7. **Community Updates**: Share news and updates

## Resources

- [Resend Documentation](https://resend.com/docs)
- [Resend React Email](https://react.email) - For more advanced templates
- [Email Best Practices](https://resend.com/docs/send-with-nextjs)

## Support

If you encounter issues:
1. Check Resend dashboard for delivery status
2. Review server logs for error messages
3. Verify environment variables are loaded correctly
4. Test with a different email address
5. Contact Resend support if issues persist
