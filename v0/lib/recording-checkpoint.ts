import { db } from './db';
import type { ActiveRecordingSession } from './db';
import type { GPSPoint } from '@/hooks/use-gps-tracking';

const LOCAL_STORAGE_KEY = 'active_recording_checkpoint';

export interface RecordingCheckpoint {
  sessionId?: number;
  userId: number;
  status: 'recording' | 'paused' | 'interrupted';
  startedAt: number; // timestamp
  lastCheckpointAt: number;
  distanceKm: number;
  durationSeconds: number;
  elapsedRunMs: number;
  gpsPath: GPSPoint[];
  lastRecordedPoint?: GPSPoint;
  workoutId?: number;
  routeId?: number;
  routeName?: string;
  autoPauseCount: number;
  acceptedPointCount: number;
  rejectedPointCount: number;
}

export class RecordingCheckpointService {
  private sessionId: number | undefined;

  constructor(_userId: number) {
    // userId not currently used but kept for API consistency
  }

  /**
   * Fast write to localStorage (called on every GPS point or state change)
   */
  saveToLocalStorage(checkpoint: RecordingCheckpoint): void {
    try {
      checkpoint.lastCheckpointAt = Date.now();

      // Check localStorage size limit (5MB typical)
      const checkpointJson = JSON.stringify(checkpoint);
      const sizeKB = new Blob([checkpointJson]).size / 1024;

      if (sizeKB > 4500) { // Keep under 4.5MB to be safe
        console.warn('[Checkpoint] GPS path approaching size limit, trimming old points');
        // Keep only last 10,000 points
        checkpoint.gpsPath = checkpoint.gpsPath.slice(-10000);
      }

      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(checkpoint));
      if (checkpoint.sessionId !== undefined) {
        this.sessionId = checkpoint.sessionId;
      }
    } catch (e) {
      console.error('[Checkpoint] localStorage write failed:', e);
      // If localStorage is full, try to save to IndexedDB immediately
      void this.flushToDatabase().catch(err => {
        console.error('[Checkpoint] Emergency IndexedDB flush failed:', err);
      });
    }
  }

  /**
   * Flush localStorage checkpoint to IndexedDB
   * Called periodically (every 30s) and on visibility change
   */
  async flushToDatabase(): Promise<void> {
    try {
      const checkpointJson = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!checkpointJson) {
        return;
      }

      const checkpoint: RecordingCheckpoint = JSON.parse(checkpointJson);

      // Prepare session data for database
      const sessionData = {
        userId: checkpoint.userId,
        status: checkpoint.status,
        startedAt: new Date(checkpoint.startedAt),
        lastCheckpointAt: new Date(checkpoint.lastCheckpointAt),
        distanceKm: checkpoint.distanceKm,
        durationSeconds: checkpoint.durationSeconds,
        elapsedRunMs: checkpoint.elapsedRunMs,
        gpsPath: JSON.stringify(checkpoint.gpsPath),
        lastRecordedPoint: checkpoint.lastRecordedPoint
          ? JSON.stringify(checkpoint.lastRecordedPoint)
          : undefined,
        workoutId: checkpoint.workoutId ?? undefined,
        routeId: checkpoint.routeId ?? undefined,
        routeName: checkpoint.routeName ?? undefined,
        autoPauseCount: checkpoint.autoPauseCount,
        acceptedPointCount: checkpoint.acceptedPointCount,
        rejectedPointCount: checkpoint.rejectedPointCount,
        updatedAt: new Date(),
      } as Partial<ActiveRecordingSession>;

      if (checkpoint.sessionId) {
        // Update existing session
        await db.activeRecordingSessions.update(checkpoint.sessionId, sessionData);
        this.sessionId = checkpoint.sessionId;
      } else {
        // Create new session
        const newSessionData: ActiveRecordingSession = {
          ...sessionData,
          createdAt: new Date(),
        } as ActiveRecordingSession;
        const id = await db.activeRecordingSessions.add(newSessionData);
        this.sessionId = Number(id);

        // Update localStorage with the new session ID
        checkpoint.sessionId = Number(id);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(checkpoint));
      }

      console.log('[Checkpoint] Flushed to IndexedDB, session ID:', this.sessionId);
    } catch (e) {
      console.error('[Checkpoint] Database flush failed:', e);
      throw e;
    }
  }

  /**
   * Check for incomplete session on app start
   */
  async getIncompleteSession(userId: number): Promise<ActiveRecordingSession | null> {
    try {
      let localSession: ActiveRecordingSession | null = null;

      // Check localStorage first (most recent)
      const localCheckpoint = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (localCheckpoint) {
        const checkpoint: RecordingCheckpoint = JSON.parse(localCheckpoint);
        if (checkpoint.userId === userId && checkpoint.status !== 'interrupted') {
          // Convert to ActiveRecordingSession format
          localSession = {
            id: checkpoint.sessionId,
            userId: checkpoint.userId,
            status: checkpoint.status,
            startedAt: new Date(checkpoint.startedAt),
            lastCheckpointAt: new Date(checkpoint.lastCheckpointAt),
            distanceKm: checkpoint.distanceKm,
            durationSeconds: checkpoint.durationSeconds,
            elapsedRunMs: checkpoint.elapsedRunMs,
            gpsPath: JSON.stringify(checkpoint.gpsPath),
            lastRecordedPoint: checkpoint.lastRecordedPoint
              ? JSON.stringify(checkpoint.lastRecordedPoint)
              : undefined,
            workoutId: checkpoint.workoutId ?? undefined,
            routeId: checkpoint.routeId ?? undefined,
            routeName: checkpoint.routeName ?? undefined,
            autoPauseCount: checkpoint.autoPauseCount,
            acceptedPointCount: checkpoint.acceptedPointCount,
            rejectedPointCount: checkpoint.rejectedPointCount,
            createdAt: new Date(checkpoint.startedAt),
            updatedAt: new Date(checkpoint.lastCheckpointAt),
          } as ActiveRecordingSession;

          // If we have a durable session ID, we can return immediately.
          if (typeof checkpoint.sessionId === 'number') {
            this.sessionId = checkpoint.sessionId;
            return localSession;
          }
        }
      }

      // Check IndexedDB for incomplete sessions
      const sessions = await db.activeRecordingSessions
        .where('userId')
        .equals(userId)
        .filter(s => s.status === 'recording' || s.status === 'paused')
        .toArray();

      if (sessions.length > 0) {
        // Return the most recent session
        const sorted = sessions.sort((a, b) => b.lastCheckpointAt.getTime() - a.lastCheckpointAt.getTime());
        const session = sorted[0] || null;
        if (session?.id !== undefined) {
          this.sessionId = session.id;
        }
        return session;
      }

      return localSession;
    } catch (e) {
      console.error('[Checkpoint] Failed to get incomplete session:', e);
      return null;
    }
  }

  /**
   * Clear checkpoint data after successful save or discard
   */
  async clearCheckpoint(sessionId?: number): Promise<void> {
    try {
      // Clear localStorage
      localStorage.removeItem(LOCAL_STORAGE_KEY);

      // Clear from IndexedDB if sessionId provided
      if (sessionId) {
        await db.activeRecordingSessions.delete(sessionId);
        console.log('[Checkpoint] Cleared session:', sessionId);
      } else if (this.sessionId) {
        await db.activeRecordingSessions.delete(this.sessionId);
        console.log('[Checkpoint] Cleared session:', this.sessionId);
        this.sessionId = undefined;
      }
    } catch (e) {
      console.error('[Checkpoint] Failed to clear checkpoint:', e);
      throw e;
    }
  }

  /**
   * Clear all incomplete sessions for a user (local + IndexedDB fallback)
   */
  async clearAllIncompleteSessions(userId: number): Promise<number> {
    try {
      const localCheckpoint = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (localCheckpoint) {
        try {
          const checkpoint: RecordingCheckpoint = JSON.parse(localCheckpoint);
          if (checkpoint.userId === userId) {
            localStorage.removeItem(LOCAL_STORAGE_KEY);
          }
        } catch {
          // Malformed checkpoint should not block recovery/discard flows.
          localStorage.removeItem(LOCAL_STORAGE_KEY);
        }
      }

      const sessions = await db.activeRecordingSessions
        .where('userId')
        .equals(userId)
        .filter(s => s.status === 'recording' || s.status === 'paused')
        .toArray();

      const sessionIds = sessions
        .map(session => session.id)
        .filter((id): id is number => typeof id === 'number');

      if (sessionIds.length > 0) {
        await db.activeRecordingSessions.bulkDelete(sessionIds);
      }

      this.sessionId = undefined;
      return sessionIds.length;
    } catch (e) {
      console.error('[Checkpoint] Failed to clear all incomplete sessions:', e);
      throw e;
    }
  }

  /**
   * Mark session as interrupted (called on beforeunload)
   */
  async markAsInterrupted(sessionId?: number): Promise<void> {
    try {
      const id = sessionId || this.sessionId;
      if (id !== undefined) {
        await db.activeRecordingSessions.update(id, {
          status: 'interrupted',
          updatedAt: new Date(),
        } as Partial<ActiveRecordingSession>);
        console.log('[Checkpoint] Marked session as interrupted:', id);
      }

      // Also update localStorage if present
      const localCheckpoint = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (localCheckpoint) {
        const checkpoint: RecordingCheckpoint = JSON.parse(localCheckpoint);
        checkpoint.status = 'interrupted';
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(checkpoint));
      }
    } catch (e) {
      console.error('[Checkpoint] Failed to mark as interrupted:', e);
    }
  }

  /**
   * Get current session ID
   */
  getSessionId(): number | undefined {
    return this.sessionId;
  }

  /**
   * Set session ID (for recovery scenarios)
   */
  setSessionId(sessionId: number): void {
    this.sessionId = sessionId;
  }
}
