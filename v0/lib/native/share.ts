import { Share } from '@capacitor/share';

import { isNativePlatform } from '@/lib/capacitor-platform';

export interface ShareContent {
  title?: string;
  text?: string;
  url?: string;
  dialogTitle?: string;
}

export async function shareContent(payload: ShareContent): Promise<void> {
  if (isNativePlatform()) {
    await Share.share(payload);
    return;
  }

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    await navigator.share(payload);
    return;
  }

  throw new Error('Share is not available on this platform.');
}
