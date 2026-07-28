/**
 * Secondary Screen Wake Lock helper. Never required for upload correctness.
 */
let sentinel = null;
let wantLock = false;

export function isWakeLockSupported() {
  return typeof navigator !== 'undefined' && !!navigator.wakeLock?.request;
}

export async function requestUploadWakeLock() {
  wantLock = true;
  if (!isWakeLockSupported()) return { ok: false, reason: 'unsupported' };
  try {
    if (sentinel && !sentinel.released) return { ok: true, reason: 'held' };
    sentinel = await navigator.wakeLock.request('screen');
    sentinel.addEventListener('release', () => {
      sentinel = null;
    });
    return { ok: true, reason: 'acquired' };
  } catch {
    return { ok: false, reason: 'denied' };
  }
}

export async function releaseUploadWakeLock() {
  wantLock = false;
  try {
    if (sentinel && !sentinel.released) await sentinel.release();
  } catch {
    // ignore
  }
  sentinel = null;
}

export async function reacquireWakeLockIfNeeded() {
  if (!wantLock) return { ok: false, reason: 'not_wanted' };
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
    return { ok: false, reason: 'hidden' };
  }
  return requestUploadWakeLock();
}

export function bindWakeLockVisibilityHandler() {
  if (typeof document === 'undefined') return () => {};
  const onVis = () => {
    if (document.visibilityState === 'visible') {
      void reacquireWakeLockIfNeeded();
    }
  };
  document.addEventListener('visibilitychange', onVis);
  return () => document.removeEventListener('visibilitychange', onVis);
}
