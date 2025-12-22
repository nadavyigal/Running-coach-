import { NextRequest, NextResponse } from 'next/server';
import { sendWelcomeEmail, sendBetaWaitlistEmail } from '@/lib/email';

export const runtime = 'nodejs';

/**
 * API route to send emails
 * POST /api/email/send
 *
 * Request body:
 * {
 *   type: 'welcome' | 'beta-waitlist',
 *   email: string,
 *   name?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, email, name } = body;

    // Validate required fields
    if (!type || !email) {
      return NextResponse.json(
        { error: 'Missing required fields: type and email are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    let result;

    // Send appropriate email based on type
    switch (type) {
      case 'welcome':
        result = await sendWelcomeEmail(email, name);
        break;

      case 'beta-waitlist':
        result = await sendBetaWaitlistEmail(email, name);
        break;

      default:
        return NextResponse.json(
          { error: `Invalid email type: ${type}. Supported types: welcome, beta-waitlist` },
          { status: 400 }
        );
    }

    return NextResponse.json(
      {
        success: true,
        message: `${type} email sent successfully`,
        data: result.data,
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error in email API:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send email',
      },
      { status: 500 }
    );
  }
}
