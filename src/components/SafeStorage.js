'use client';

import { installSafeStorage } from '@/lib/safeStorage';

// Runs when the client bundle loads, i.e. before any page effect can write to localStorage.
if (typeof window !== 'undefined') installSafeStorage();

export default function SafeStorage() {
  return null;
}
