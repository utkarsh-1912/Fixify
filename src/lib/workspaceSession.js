'use client';

export const WORKSPACE_SHARING_KEY = 'fixify_workspace_sharing_enabled';
export const WORKSPACE_SESSION_KEY = 'fixify_workspace_session';

export const DEFAULT_MAX_STORAGE_BYTES = 300 * 1024; // 300 KB safe limit for individual localStorage keys

export function safeSetItem(key, value, maxBytes = DEFAULT_MAX_STORAGE_BYTES) {
  if (typeof window === 'undefined') return false;
  try {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    
    // If value exceeds safe storage threshold, skip localStorage to avoid quota crash
    if (stringValue.length > maxBytes) {
      try {
        localStorage.removeItem(key);
      } catch (e) {}
      return false;
    }

    localStorage.setItem(key, stringValue);
    return true;
  } catch (err) {
    console.warn(`[safeStorage] Failed to save key "${key}" to localStorage:`, err?.message || err);
    return false;
  }
}

export function safeGetItem(key) {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(key);
  } catch (err) {
    console.warn(`[safeStorage] Failed to read key "${key}":`, err?.message || err);
    return null;
  }
}

export function safeRemoveItem(key) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(key);
  } catch (err) {}
}

export function isWorkspaceSharingEnabled() {
  if (typeof window === 'undefined') return false;
  return safeGetItem(WORKSPACE_SHARING_KEY) === 'true';
}

export function setWorkspaceSharingEnabled(enabled) {
  if (typeof window === 'undefined') return;
  safeSetItem(WORKSPACE_SHARING_KEY, enabled ? 'true' : 'false');
  window.dispatchEvent(new CustomEvent('fixify-workspace-toggle', { detail: { enabled } }));
}

export function getWorkspaceSession() {
  if (typeof window === 'undefined') return null;
  if (!isWorkspaceSharingEnabled()) return null;
  try {
    const data = safeGetItem(WORKSPACE_SESSION_KEY);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.warn('Failed to parse workspace session:', e);
    return null;
  }
}

export function setWorkspaceSession(sessionData) {
  if (typeof window === 'undefined') return;
  if (!isWorkspaceSharingEnabled()) return;
  try {
    const payload = {
      rawText: sessionData.rawText && sessionData.rawText.length < DEFAULT_MAX_STORAGE_BYTES ? sessionData.rawText : '',
      parsedCount: sessionData.parsedCount || 0,
      timestamp: Date.now(),
      source: sessionData.source || 'user',
      ...sessionData
    };
    // Protect rawText in storage payload
    if (payload.rawText && payload.rawText.length > DEFAULT_MAX_STORAGE_BYTES) {
      payload.rawText = ''; // Omit large payload from storage
    }
    safeSetItem(WORKSPACE_SESSION_KEY, payload);
    if (sessionData.rawText && sessionData.rawText.length <= DEFAULT_MAX_STORAGE_BYTES) {
      safeSetItem('fixify-logs-pastedText', sessionData.rawText);
    }
    window.dispatchEvent(new CustomEvent('fixify-workspace-update', { detail: payload }));
  } catch (e) {
    console.warn('Failed to save workspace session:', e);
  }
}

export function clearWorkspaceSession() {
  if (typeof window === 'undefined') return;
  safeRemoveItem(WORKSPACE_SESSION_KEY);
  window.dispatchEvent(new CustomEvent('fixify-workspace-update', { detail: null }));
}
