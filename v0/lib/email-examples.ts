/**
 * Email Integration Examples
 *
 * This file demonstrates how to use the Resend email service
 * in your Run-Smart application.
 */

// ============================================================================
// EXAMPLE 1: Send Welcome Email After User Signs Up
// ============================================================================

/**
 * Call this function after a user completes onboarding
 * @param email - User's email address
 * @param name - User's name (optional)
 */
export async function sendUserWelcomeEmail(email: string, name?: string) {
  try {
    const response = await fetch('/api/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'welcome',
        email: email,
        name: name,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send welcome email');
    }

    const result = await response.json();
    console.log('Welcome email sent:', result);
    return result;
  } catch (error) {
    console.error('Error sending welcome email:', error);
    throw error;
  }
}

// ============================================================================
// EXAMPLE 2: Send Beta Waitlist Confirmation
// ============================================================================

/**
 * Call this function when a user joins the beta waitlist
 * @param email - User's email address
 * @param name - User's name (optional)
 */
export async function sendBetaWaitlistConfirmation(email: string, name?: string) {
  try {
    const response = await fetch('/api/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'beta-waitlist',
        email: email,
        name: name,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send beta waitlist email');
    }

    const result = await response.json();
    console.log('Beta waitlist email sent:', result);
    return result;
  } catch (error) {
    console.error('Error sending beta waitlist email:', error);
    throw error;
  }
}

// ============================================================================
// EXAMPLE 3: Integration with OnboardingScreen
// ============================================================================

/**
 * Example of how to integrate email sending in your OnboardingScreen component
 *
 * Add this code to your OnboardingScreen.tsx after user completes onboarding:
 *
 * ```typescript
 * import { sendUserWelcomeEmail } from '@/lib/email-examples';
 *
 * // In your onboarding completion handler:
 * const handleOnboardingComplete = async (userData: User) => {
 *   try {
 *     // Save user to database
 *     const savedUser = await db.users.add(userData);
 *
 *     // Send welcome email (non-blocking, don't wait for it)
 *     sendUserWelcomeEmail(userData.email, userData.name)
 *       .catch(error => {
 *         console.error('Failed to send welcome email:', error);
 *         // Email failure shouldn't block user flow
 *       });
 *
 *     // Continue with app flow
 *     setCurrentScreen('today');
 *   } catch (error) {
 *     console.error('Error completing onboarding:', error);
 *   }
 * };
 * ```
 */

// ============================================================================
// EXAMPLE 4: Creating a Beta Waitlist Landing Page Component
// ============================================================================

/**
 * Example component for a beta waitlist form
 *
 * ```tsx
 * 'use client';
 *
 * import { useState } from 'react';
 * import { sendBetaWaitlistConfirmation } from '@/lib/email-examples';
 *
 * export function BetaWaitlistForm() {
 *   const [email, setEmail] = useState('');
 *   const [name, setName] = useState('');
 *   const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
 *   const [message, setMessage] = useState('');
 *
 *   const handleSubmit = async (e: React.FormEvent) => {
 *     e.preventDefault();
 *     setStatus('loading');
 *     setMessage('');
 *
 *     try {
 *       await sendBetaWaitlistConfirmation(email, name);
 *       setStatus('success');
 *       setMessage('Thank you! Check your email for confirmation.');
 *       setEmail('');
 *       setName('');
 *     } catch (error) {
 *       setStatus('error');
 *       setMessage('Something went wrong. Please try again.');
 *       console.error(error);
 *     }
 *   };
 *
 *   return (
 *     <form onSubmit={handleSubmit} className="space-y-4">
 *       <input
 *         type="text"
 *         placeholder="Your Name (optional)"
 *         value={name}
 *         onChange={(e) => setName(e.target.value)}
 *         className="w-full px-4 py-2 border rounded-lg"
 *       />
 *       <input
 *         type="email"
 *         placeholder="Your Email"
 *         value={email}
 *         onChange={(e) => setEmail(e.target.value)}
 *         required
 *         className="w-full px-4 py-2 border rounded-lg"
 *       />
 *       <button
 *         type="submit"
 *         disabled={status === 'loading'}
 *         className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg disabled:opacity-50"
 *       >
 *         {status === 'loading' ? 'Joining...' : 'Join Waitlist'}
 *       </button>
 *       {message && (
 *         <p className={status === 'success' ? 'text-green-600' : 'text-red-600'}>
 *           {message}
 *         </p>
 *       )}
 *     </form>
 *   );
 * }
 * ```
 */

// ============================================================================
// EXAMPLE 5: Direct Server-Side Email Sending
// ============================================================================

/**
 * If you need to send emails from server components or API routes,
 * you can use the email utilities directly:
 *
 * ```typescript
 * import { sendWelcomeEmail, sendBetaWaitlistEmail } from '@/lib/email';
 *
 * // In your API route or server component:
 * export async function POST(request: Request) {
 *   const { email, name } = await request.json();
 *
 *   try {
 *     const result = await sendWelcomeEmail(email, name);
 *     return Response.json({ success: true, data: result });
 *   } catch (error) {
 *     return Response.json({ success: false, error: error.message }, { status: 500 });
 *   }
 * }
 * ```
 */

// ============================================================================
// BEST PRACTICES
// ============================================================================

/**
 * 1. Don't block user flow: Send emails asynchronously and don't wait for them
 * 2. Handle errors gracefully: Email failures shouldn't crash your app
 * 3. Validate email addresses before sending
 * 4. Consider rate limiting for public-facing email endpoints
 * 5. Log email sends for debugging and analytics
 * 6. Test with real email addresses during development
 * 7. Use environment variables for API keys (never commit them)
 */
