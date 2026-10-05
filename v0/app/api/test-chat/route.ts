import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'Chat API is working',
    timestamp: new Date().toISOString(),
    openaiKey: process.env.OPENAI_API_KEY ? 'Present' : 'Missing'
  });
}

export async function POST() {
  try {
    const testResponse = "Hello! I'm your AI running coach. This is a test response to verify the API is working correctly.";
    
    // Return a simple text stream to test streaming functionality
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
        }, 100); // Send a word every 100ms
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Test-Response': 'true'
      }
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Test endpoint failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}