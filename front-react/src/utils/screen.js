import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Checks whether the current device/viewport corresponds to a mobile device.
 */
export function isMobileDevice() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches) ||
    window.innerWidth < 768
  );
}

/**
 * Checks whether the Fullscreen API is available in the current browser environment.
 */
export function isFullscreenSupported() {
  if (typeof document === 'undefined') return false;
  return Boolean(
    document.fullscreenEnabled ||
    document.webkitFullscreenEnabled ||
    document.mozFullScreenEnabled ||
    document.msFullscreenEnabled ||
    document.documentElement.requestFullscreen ||
    document.documentElement.webkitRequestFullscreen
  );
}

/**
 * Checks whether the browser is currently in fullscreen mode.
 */
export function isBrowserFullscreen() {
  if (typeof document === 'undefined') return false;
  return Boolean(
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement
  );
}

/**
 * Enters native browser fullscreen mode on the given element.
 */
export async function enterBrowserFullscreen(element = document.documentElement) {
  if (!element || isBrowserFullscreen()) return;
  try {
    if (element.requestFullscreen) {
      await element.requestFullscreen();
    } else if (element.webkitRequestFullscreen) {
      await element.webkitRequestFullscreen();
    } else if (element.mozRequestFullScreen) {
      await element.mozRequestFullScreen();
    } else if (element.msRequestFullscreen) {
      await element.msRequestFullscreen();
    }
  } catch (err) {
    // Non-fatal: browsers disallow fullscreen without transient activation or on iPhone Safari
    console.warn('Enter browser fullscreen failed:', err);
  }
}

/**
 * Safely exits native browser fullscreen mode if currently active.
 */
export async function exitBrowserFullscreen() {
  if (!isBrowserFullscreen()) return;
  try {
    if (document.exitFullscreen) {
      await document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      await document.webkitExitFullscreen();
    } else if (document.mozCancelFullScreen) {
      await document.mozCancelFullScreen();
    } else if (document.msExitFullscreen) {
      await document.msExitFullscreen();
    }
  } catch (err) {
    console.warn('Exit browser fullscreen failed:', err);
  }
}

/**
 * Toggles native browser fullscreen mode.
 */
export async function toggleBrowserFullscreen() {
  if (isBrowserFullscreen()) {
    await exitBrowserFullscreen();
  } else {
    await enterBrowserFullscreen();
  }
}

/**
 * React hook to manage Screen Wake Lock (preventing display sleeping/turn-off).
 * Automatically re-requests lock upon tab visibility restoration.
 */
export function useScreenWakeLock(enabled = true) {
  const [isActive, setIsActive] = useState(false);
  const [isSupported] = useState(() => typeof navigator !== 'undefined' && 'wakeLock' in navigator);
  const wakeLockRef = useRef(null);

  const requestLock = useCallback(async () => {
    if (!isSupported || !enabled || document.visibilityState !== 'visible') return;
    try {
      if (wakeLockRef.current && !wakeLockRef.current.released) {
        return;
      }
      const lock = await navigator.wakeLock.request('screen');
      wakeLockRef.current = lock;
      setIsActive(true);
      lock.addEventListener('release', () => {
        setIsActive(false);
        wakeLockRef.current = null;
      });
    } catch (err) {
      console.warn('Screen Wake Lock request failed:', err);
      setIsActive(false);
    }
  }, [isSupported, enabled]);

  const releaseLock = useCallback(async () => {
    try {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    } catch (err) {
      console.warn('Screen Wake Lock release failed:', err);
    } finally {
      setIsActive(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      requestLock();
    } else {
      releaseLock();
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && enabled) {
        requestLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseLock();
    };
  }, [enabled, requestLock, releaseLock]);

  return { isSupported, isActive, requestLock, releaseLock };
}
