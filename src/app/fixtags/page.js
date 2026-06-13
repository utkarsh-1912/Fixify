'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { BookOpen, Search, Layers, ChevronRight, HelpCircle } from 'lucide-react';
import TagDetailsModal from '@/components/TagDetailsModal';

import fix40 from '@/data/FIX/FIX40.json';
import fix42 from '@/data/FIX/FIX42.json';
import fix44 from '@/data/FIX/FIX44.json';
import fix50 from '@/data/FIX/FIX50.json';
import fixt11 from '@/data/FIX/FIXT11.json';

const DICT_VERSIONS = [
  { value: "FIX.4.0", label: "FIX 4.0", data: fix40 },
  { value: "FIX.4.2", label: "FIX 4.2", data: fix42 },
  { value: "FIX.4.4", label: "FIX 4.4", data: fix44 },
  { value: "FIX.5.0", label: "FIX 5.0", data: fix50 },
  { value: "FIXT.1.1", label: "FIXT 1.1", data: fixt11 },
];

export default function FIXDictionaryPage() {
  const [selectedVersion, setSelectedVersion] = useState("FIX.4.4");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTag, setActiveTag] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load state on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedVer = localStorage.getItem('fixify-dict-version');
    if (savedVer) setSelectedVersion(savedVer);
    const savedQuery = localStorage.getItem('fixify-dict-query');
    if (savedQuery) setSearchQuery(savedQuery);
    setIsLoaded(true);
  }, []);

  // Save state on change
  useEffect(() => {
    if (!isLoaded || typeof window === 'undefined') return;
    localStorage.setItem('fixify-dict-version', selectedVersion);
  }, [selectedVersion, isLoaded]);

  useEffect(() => {
    if (!isLoaded || typeof window === 'undefined') return;
    localStorage.setItem('fixify-dict-query', searchQuery);
  }, [searchQuery, isLoaded]);

  // Retrieve current version dictionary fields
  const currentDict = useMemo(() => {
    const v = DICT_VERSIONS.find(ver => ver.value === selectedVersion);
    return v ? v.data : fix44;
  }, [selectedVersion]);

  // Filter fields based on search query
  const filteredFields = useMemo(() => {
    const fields = currentDict.fields || [];
    const query = searchQuery.trim().toLowerCase();
    if (!query) return fields;

    return fields.filter(
      (f) =>
        f.tag.toString().includes(query) ||
        f.name.toLowerCase().includes(query) ||
        (f.type || "").toLowerCase().includes(query)
    );
  }, [currentDict, searchQuery]);

  // Slice list for performance (prevent UI lag with thousands of nodes)
  const displayedFields = useMemo(() => {
    return filteredFields.slice(0, 120);
  }, [filteredFields]);

  return (
    <div className="space-y-6 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="fx-page-header flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5" style={{ color: 'var(--foreground)' }}>
            <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--primary-faint)', border: '1px solid var(--primary-border)' }}>
              <BookOpen className="h-5 w-5" style={{ color: 'var(--primary)' }} />
            </div>
            FIX Dictionary Explorer
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Lookup tag specifications, data types, usage notes, and allowed enum values.
          </p>
        </div>
      </div>

      {/* Toolbar Filter */}
      <div
        className="flex flex-col sm:flex-row gap-4 p-4 rounded-2xl items-stretch sm:items-center"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search by Tag ID, Field Name, or Data Type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-zinc-950/50 border border-zinc-800 focus:border-[var(--primary)] outline-none rounded-xl text-xs font-mono text-zinc-300 transition-colors"
            style={{ background: 'var(--background)', border: '1px solid var(--border)' }}
          />
        </div>

        {/* Version dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold font-mono text-zinc-500 uppercase tracking-wider">Protocol Version:</span>
          <select
            value={selectedVersion}
            onChange={(e) => setSelectedVersion(e.target.value)}
            className="px-3.5 py-2 border border-zinc-850 rounded-xl text-xs font-mono outline-none cursor-pointer text-zinc-350 focus:border-[var(--primary)]"
            style={{ background: 'var(--background)', border: '1px solid var(--border)' }}
          >
            {DICT_VERSIONS.map((v) => (
              <option key={v.value} value={v.value}>{v.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats indicators */}
      <div className="flex items-center justify-between text-xs font-mono px-1" style={{ color: 'var(--text-muted)' }}>
        <span>
          Showing {displayedFields.length} of {filteredFields.length} matching tags
        </span>
        {filteredFields.length > 120 && (
          <span style={{ color: 'var(--primary)' }}>
            Refine search query to see remaining {filteredFields.length - 120} tags
          </span>
        )}
      </div>

      {/* Grid List */}
      {displayedFields.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {displayedFields.map((f) => (
            <div
              key={f.tag}
              onClick={() => setActiveTag(f.tag)}
              className="p-4 rounded-xl cursor-pointer hover:-translate-y-0.5 transition-all flex items-center justify-between group"
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--primary-border)';
                e.currentTarget.style.background = 'var(--card-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.background = 'var(--card)';
              }}
            >
              <div className="space-y-1.5 truncate">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-extrabold text-[var(--primary)]">
                    {f.tag}
                  </span>
                  <span className="font-bold text-xs truncate max-w-[140px]" style={{ color: 'var(--foreground)' }}>
                    {f.name}
                  </span>
                </div>
                <div className="flex gap-1.5 items-center">
                  <span className="text-[9px] font-mono font-bold bg-zinc-150 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 px-1.5 py-0.5 rounded uppercase">
                    {f.type}
                  </span>
                  {f.values && f.values.length > 0 && (
                    <span className="text-[9px] font-mono font-bold bg-[var(--primary-faint)] text-[var(--primary)] px-1.5 py-0.5 rounded border border-[var(--primary-border)] uppercase">
                      {f.values.length} Enums
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight 
                className="h-4 w-4 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all"
                style={{ color: 'var(--primary)' }}
              />
            </div>
          ))}
        </div>
      ) : (
        <div 
          className="py-16 text-center rounded-2xl flex flex-col items-center justify-center gap-2 border border-dashed"
          style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
        >
          <HelpCircle className="h-8 w-8 text-zinc-500" />
          <p className="text-sm font-semibold text-zinc-400">No tag definitions matched your query.</p>
          <button 
            onClick={() => setSearchQuery("")} 
            className="text-xs font-mono hover:underline mt-1"
            style={{ color: 'var(--primary)' }}
          >
            Clear Search Filter
          </button>
        </div>
      )}

      {/* Shared Tag Details Modal */}
      {activeTag && (
        <TagDetailsModal
          tag={activeTag}
          version={selectedVersion}
          isOpen={!!activeTag}
          onClose={() => setActiveTag(null)}
        />
      )}
    </div>
  );
}
