'use client';

export const WORKSPACE_SHARING_KEY = 'fixify_workspace_sharing_enabled';
export const WORKSPACE_SESSION_KEY = 'fixify_workspace_session';

export function isWorkspaceSharingEnabled() {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(WORKSPACE_SHARING_KEY) === 'true';
}

export function setWorkspaceSharingEnabled(enabled) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(WORKSPACE_SHARING_KEY, enabled ? 'true' : 'false');
  window.dispatchEvent(new CustomEvent('fixify-workspace-toggle', { detail: { enabled } }));
}

export function getWorkspaceSession() {
  if (typeof window === 'undefined') return null;
  if (!isWorkspaceSharingEnabled()) return null;
  try {
    const data = localStorage.getItem(WORKSPACE_SESSION_KEY);
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
    // localStorage holds ~5 MB; never try to mirror a huge log into it (QuotaExceededError).
    const MAX = 1000000;
    let raw = sessionData.rawText || '';
    let truncated = false;
    if (raw.length > MAX) {
      const cut = raw.lastIndexOf('\n', MAX);
      raw = raw.slice(0, cut > 0 ? cut : MAX);
      truncated = true;
    }
    const payload = {
      rawText: raw,
      parsedCount: sessionData.parsedCount || 0,
      timestamp: Date.now(),
      source: sessionData.source || 'user',
      ...sessionData,
      rawText: raw,
      truncated
    };
    localStorage.setItem(WORKSPACE_SESSION_KEY, JSON.stringify(payload));
    // Also update legacy key for backward compatibility if present
    localStorage.setItem('fixify-logs-pastedText', raw);
    window.dispatchEvent(new CustomEvent('fixify-workspace-update', { detail: payload }));
  } catch (e) {
    console.warn('Failed to save workspace session:', e);
  }
}

export function clearWorkspaceSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(WORKSPACE_SESSION_KEY);
  window.dispatchEvent(new CustomEvent('fixify-workspace-update', { detail: null }));
}
