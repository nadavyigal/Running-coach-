import { startOfWeek } from 'date-fns';
import { ENABLE_WEEKLY_RECAP } from '@/lib/featureFlags';

const STORAGE_KEY = 'lastRecapNotificationDate';

const canUseLocalStorage = () => {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  } catch {
    return false;
  }
};

export function shouldShowWeeklyRecapNotification(): boolean {
  if (!ENABLE_WEEKLY_RECAP) return false;
  if (!canUseLocalStorage()) return false;

  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday
  if (dayOfWeek !== 1) return false;

  const hour = now.getHours();
  if (hour < 7 || hour >= 9) return false;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return true;
    const lastDate = new Date(raw);
    if (Number.isNaN(lastDate.getTime())) return true;
    const lastWeekStart = startOfWeek(lastDate, { weekStartsOn: 1 });
    const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
    return lastWeekStart.getTime() < thisWeekStart.getTime();
  } catch {
    return false;
  }
}

export function markRecapNotificationShown(): void {
  if (!ENABLE_WEEKLY_RECAP) return;
  if (!canUseLocalStorage()) return;

  try {
    window.localStorage.setItem(STORAGE_KEY, new Date().toISOString());
  } catch {
    // silencing failures
  }
}
