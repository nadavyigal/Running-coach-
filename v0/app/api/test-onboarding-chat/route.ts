import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'Onboarding Chat API is working',
    timestamp: new Date().toISOString(),
    openaiKey: process.env.OPENAI_API_KEY ? 'Present' : 'Missing',
    endpoint: '/api/onboarding/chat'
  });
}

export async function POST() {
  try {
    const testResponse = "Hello! I'm your AI running coach for onboarding. I'm here to help you discover your running goals and create a personalized plan. What motivates you to start or continue running?";
    
    // Return a simple text stream to test onboarding streaming functionality
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        const words = testResponse.split(' ');
        
        let index = 0;
        const interval = setInterval(() => {
          if (index < words.length) {
            // Simulate the streaming format used by the AI SDK
            const data = JSON.stringify({ textDelta: words[index] + ' ' });
            controller.enqueue(encoder.encode(`0:${data}\n`));
            index++;
          } else {
            clearInterval(interval);
            controller.close();
          }
        }, 150); // Send a word every 150ms (slower for onboarding)
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Test-Response': 'true',
        'X-Coaching-Interaction-Id': `test-onboarding-${Date.now()}`,
        'X-Coaching-Confidence': '0.9',
        'X-Onboarding-Next-Phase': 'motivation'
      }
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Test onboarding endpoint failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}