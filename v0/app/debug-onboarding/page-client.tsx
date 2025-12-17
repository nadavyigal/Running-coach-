'use client';

import { useEffect, useState } from 'react';
import { dbUtils } from '@/lib/dbUtils';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export default function DebugOnboardingPage() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fixing, setFixing] = useState(false);

  useEffect(() => {
    checkStatus();
  }, []);

  async function checkStatus() {
    setLoading(true);
    try {
      // Check database
      await dbUtils.initializeDatabase();
      const user = await dbUtils.getCurrentUser();

      // Check localStorage
      const localOnboarding = localStorage.getItem('onboarding-complete');
      const localUserData = localStorage.getItem('user-data');

      // Get all users
      const allUsers = await db.users.toArray();

      setStatus({
        user,
        allUsers,
        localStorage: {
          onboardingComplete: localOnboarding,
          userData: localUserData ? JSON.parse(localUserData) : null
        },
        mismatch: user ? (user.onboardingComplete && localOnboarding !== 'true') : false
      });
    } catch (error) {
      logger.error('Debug error:', error);
      setStatus({ error: error.message });
    } finally {
      setLoading(false);
    }
  }

  async function forceCompleteOnboarding() {
    setFixing(true);
    try {
      const user = await dbUtils.getCurrentUser();
      if (user && user.id) {
        // Force update user to complete onboarding
        await db.users.update(user.id, {
          onboardingComplete: true,
          updatedAt: new Date()
        });

        // Force sync localStorage
        localStorage.setItem('onboarding-complete', 'true');
        localStorage.setItem('user-data', JSON.stringify({
          id: user.id,
          experience: user.experience || 'beginner',
          goal: user.goal || 'habit',
          daysPerWeek: user.daysPerWeek || 3,
          preferredTimes: user.preferredTimes || ['morning'],
        }));

        alert('✅ Onboarding forced to complete! Refreshing...');
        window.location.href = '/';
      }
    } catch (error) {
      logger.error('Fix error:', error);
      alert('❌ Failed to fix: ' + error.message);
    } finally {
      setFixing(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold mb-4">🔍 Checking Database State...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-4">🔍 Onboarding Debug Panel</h1>

        {status?.error ? (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <strong>Error:</strong> {status.error}
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-2">Current User</h2>
              <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
                {JSON.stringify(status?.user, null, 2)}
              </pre>
            </div>

            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-2">localStorage State</h2>
              <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
                {JSON.stringify(status?.localStorage, null, 2)}
              </pre>
            </div>

            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-2">All Users in Database</h2>
              <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
                {JSON.stringify(status?.allUsers, null, 2)}
              </pre>
            </div>

            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-2">Diagnosis</h2>
              <div className="space-y-2">
                <div className={`p-3 rounded ${status?.user?.onboardingComplete ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  <strong>Database onboardingComplete:</strong> {status?.user?.onboardingComplete ? '✅ true' : '❌ false'}
                </div>
                <div className={`p-3 rounded ${status?.localStorage?.onboardingComplete === 'true' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  <strong>localStorage onboardingComplete:</strong> {status?.localStorage?.onboardingComplete === 'true' ? '✅ true' : '❌ false or missing'}
                </div>
                {status?.mismatch && (
                  <div className="p-3 rounded bg-yellow-100 text-yellow-800">
                    <strong>⚠️ State Mismatch Detected!</strong> Database says complete but localStorage doesn't match.
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <button
                onClick={forceCompleteOnboarding}
                disabled={fixing}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-semibold"
              >
                {fixing ? 'Fixing...' : '🔧 Force Complete Onboarding & Sync State'}
              </button>

              <button
                onClick={checkStatus}
                className="w-full px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-semibold"
              >
                🔄 Refresh Status
              </button>

              <button
                onClick={() => window.location.href = '/'}
                className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
              >
                🏠 Go to Home
              </button>
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded">
              <h3 className="font-semibold mb-2">📝 Instructions:</h3>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>Check if "Database onboardingComplete" is false - this is the issue</li>
                <li>Click "Force Complete Onboarding" to fix the database</li>
                <li>You'll be redirected to home - try clicking Profile again</li>
                <li>If issue persists, check the console for errors</li>
              </ol>
            </div>
          </>
        )}
      </div>
    </div>
  );
}