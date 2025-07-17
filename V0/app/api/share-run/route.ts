import { NextResponse } from 'next/server';
import { dbUtils } from '../../../lib/db';

export async function POST(request: Request) {
  try {
    const { runId, userId } = await request.json();
    if (!runId || !userId) {
      return NextResponse.json({ message: 'Missing runId or userId' }, { status: 400 });
    }

    // Fetch all runs for the user and find the run by ID
    const runs = await dbUtils.getRunsByUser(Number(userId));
    const run = runs.find((r: any) => r.id === Number(runId));
    if (!run) {
      return NextResponse.json({ message: 'Run not found or unauthorized' }, { status: 404 });
    }

    // Generate a unique shareable link (could be a token, here just a placeholder)
    const shareableLink = `https://runsmart.com/share/run/${run.id}`;

    // Optionally: Store/share token in DB for tracking (not implemented here)

    return NextResponse.json({ shareableLink });
  } catch (error) {
    console.error('Error generating shareable link:', error);
    return NextResponse.json({ message: 'Error generating shareable link' }, { status: 500 });
  }
}
