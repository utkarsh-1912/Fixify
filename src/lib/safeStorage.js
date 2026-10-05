// localStorage allows ~5 MB per origin. Many pages persist logs / state from effects, and a write
// that throws QuotaExceededError there takes the whole page down. Installing this once makes such
// writes fail soft: the value is simply not persisted (and any stale copy is dropped so a reload
// never restores an out-of-date value). Other errors are re-thrown unchanged.

export const isQuotaError = (e) =>
  !!e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014);

export function installSafeStorage(StorageCtor = globalThis.Storage) {
  if (!StorageCtor || StorageCtor.prototype.__fixifySafeSetItem) return false;
  const original = StorageCtor.prototype.setItem;
  StorageCtor.prototype.setItem = function safeSetItem(key, value) {
    try {
      return original.call(this, key, value);
    } catch (e) {
      if (!isQuotaError(e)) throw e;
      console.warn(`[storage] "${key}" (${String(value).length} chars) exceeds the browser storage quota; not persisted.`);
      try {
        this.removeItem(key);
      } catch {}
    }
  };
  StorageCtor.prototype.__fixifySafeSetItem = true;
  return true;
}
