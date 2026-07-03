/**
 * Web Notifications Helper for oraneo
 */

export async function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  try {
    if (Notification.permission === 'granted') return true;
    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
  } catch (e) {
    console.warn('[Notifications] Error requesting permission:', e.message);
  }
  return false;
}

export async function sendWebNotification(title, body, icon = '/icon.png') {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  try {
    if (Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon,
        badge: icon,
        vibrate: [200, 100, 200],
      });
    } else {
      await requestNotificationPermission();
      if (Notification.permission === 'granted') {
        new Notification(title, { body, icon });
      }
    }
  } catch (e) {
    console.warn('[Notifications] Trigger failed:', e.message);
  }
}
