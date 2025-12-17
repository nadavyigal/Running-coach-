import { NextResponse } from 'next/server';
import { dbUtils } from '@/lib/dbUtils';
import { logger } from '@/lib/logger';

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

    // Get user information for better sharing content
    const user = await dbUtils.getCurrentUser();
    const userName = user?.name || 'A runner';

    // Format run details for sharing
    const distanceKm = run.distance.toFixed(2);
    const durationMinutes = Math.floor(run.duration / 60);
    const paceMinutes = Math.floor(run.pace / 60);
    const paceSeconds = Math.floor(run.pace % 60);
    const formattedPace = `${paceMinutes}:${paceSeconds.toString().padStart(2, '0')}`;
    const runType = run.type.charAt(0).toUpperCase() + run.type.slice(1);

    // Generate shareable content
    const shareableContent = {
      title: `${userName}'s ${runType} Run`,
      description: `Just completed a ${distanceKm}km ${runType.toLowerCase()} run in ${durationMinutes} minutes! Average pace: ${formattedPace}/km`,
      distance: distanceKm,
      duration: durationMinutes,
      pace: formattedPace,
      type: runType,
      calories: run.calories,
      date: new Date(run.completedAt).toLocaleDateString(),
    };

    // Generate a unique shareable link
    const shareableLink = `${process.env.NEXT_PUBLIC_APP_URL || 'https://runsmart.com'}/share/run/${run.id}`;

    // Generate social media sharing URLs
    const encodedTitle = encodeURIComponent(shareableContent.title);
    const encodedDescription = encodeURIComponent(shareableContent.description);
    const encodedUrl = encodeURIComponent(shareableLink);

    const socialShareUrls = {
      twitter: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedDescription}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      whatsapp: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
    };

    return NextResponse.json({ 
      shareableLink,
      shareableContent,
      socialShareUrls
    });
  } catch (error) {
    logger.error('Error generating shareable link:', error);
    return NextResponse.json({ message: 'Error generating shareable link' }, { status: 500 });
  }
}