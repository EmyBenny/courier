import type { CourierNotification, PushSubscriptionPrefs } from '../types/courier';

const PREFS_STORAGE_KEY = 'camber_push_prefs_v1';

export const DEFAULT_PUSH_PREFS: PushSubscriptionPrefs = {
  enabled: false,
  outForDelivery: true,
  arrivingSoon: true,
  delays: true,
  delivered: true,
  soundEnabled: true,
  watchedTrackingCode: null,
};

export function loadPushPrefs(): PushSubscriptionPrefs {
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return DEFAULT_PUSH_PREFS;
    return { ...DEFAULT_PUSH_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PUSH_PREFS;
  }
}

export function savePushPrefs(prefs: PushSubscriptionPrefs): void {
  try {
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage errors
  }
}

let swRegistration: ServiceWorkerRegistration | null = null;

export async function registerPushServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    if (!swRegistration) {
      swRegistration = await navigator.serviceWorker.register('/sw.js');
    }
    return swRegistration;
  } catch {
    return null;
  }
}

export async function requestDeviceNotificationPermission(): Promise<NotificationPermission> {
  await registerPushServiceWorker();
  if (typeof Notification === 'undefined') {
    return 'denied';
  }
  if (Notification.permission === 'granted') {
    return 'granted';
  }
  if (Notification.permission === 'default') {
    return Notification.requestPermission();
  }
  return Notification.permission;
}

function playNotificationChime() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const playTone = (freq: number, startOffset: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + startOffset);
      gain.gain.setValueAtTime(0.001, now + startOffset);
      gain.gain.exponentialRampToValueAtTime(0.08, now + startOffset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + startOffset + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + startOffset);
      osc.stop(now + startOffset + duration);
    };

    playTone(587.33, 0, 0.14);
    playTone(880, 0.11, 0.2);
  } catch {
    // Ignore audio context autoplay blocks
  }
}

export function shouldDeliverForEvent(
  notification: CourierNotification,
  prefs: PushSubscriptionPrefs
): boolean {
  if (!prefs.enabled) return false;
  if (
    prefs.watchedTrackingCode &&
    notification.trackingCode !== prefs.watchedTrackingCode
  ) {
    return false;
  }

  const evt = notification.eventType;
  if (evt === 'out_for_delivery') return prefs.outForDelivery;
  if (evt === 'arriving_soon') return prefs.arrivingSoon;
  if (evt === 'delivered') return prefs.delivered;
  if (evt === 'delayed') return prefs.delays;
  return true;
}

export async function dispatchDevicePushNotification(
  notification: CourierNotification,
  prefs: PushSubscriptionPrefs
): Promise<boolean> {
  if (!shouldDeliverForEvent(notification, prefs)) {
    return false;
  }

  if (prefs.soundEnabled) {
    playNotificationChime();
  }

  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return false;
  }

  const title = `${notification.trackingCode} · ${notification.title}`;
  const options: NotificationOptions = {
    body: notification.message,
    tag: `camber-${notification.trackingCode}-${notification.eventType ?? 'info'}`,
    data: {
      parcelId: notification.parcelId,
      trackingCode: notification.trackingCode,
    },
  };

  try {
    const reg = await registerPushServiceWorker();
    if (reg && typeof reg.showNotification === 'function') {
      await reg.showNotification(title, options);
      return true;
    }
    new Notification(title, options);
    return true;
  } catch {
    try {
      new Notification(title, options);
      return true;
    } catch {
      return false;
    }
  }
}
