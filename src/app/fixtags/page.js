'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { BookOpen, Search, ChevronRight, HelpCircle, Upload, Trash2, ArrowLeft, ArrowRight, ChevronsLeft, ChevronsRight, ChevronLeft } from 'lucide-react';
import TagDetailsModal from '@/components/TagDetailsModal';
import { parseQuickFixXml, getCustomDialect, clearCustomDialectCache } from '@/lib/dialect';

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
  const searchInputRef = useRef(null);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // Ctrl+F or Cmd+F to focus search input
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          searchInputRef.current.select();
        }
      }
      // Escape to clear search and blur
      if (e.key === 'Escape') {
        if (document.activeElement === searchInputRef.current) {
          e.preventDefault();
          setSearchQuery("");
          searchInputRef.current.blur();
        }
      }
    };
    
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Custom dialect states
  const [customDialect, setCustomDialect] = useState(null);
  const [uploadError, setUploadError] = useState("");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(60);

  // Load state on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Load custom dialect if any
    const custom = getCustomDialect();
    if (custom) {
      setCustomDialect(custom);
    }

    const savedVer = localStorage.getItem('fixify-dict-version');
    if (savedVer) {
      setSelectedVersion(savedVer);
    } else if (custom) {
      setSelectedVersion(custom.version);
    }

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

  // Combine static and custom versions
  const versionsList = useMemo(() => {
    const list = [...DICT_VERSIONS];
    if (customDialect) {
      list.push({
        value: customDialect.version,
        label: `Custom Dialect (${customDialect.version})`,
        data: customDialect
      });
    }
    return list;
  }, [customDialect]);

  // Retrieve current version dictionary fields
  const currentDict = useMemo(() => {
    const v = versionsList.find(ver => ver.value === selectedVersion);
    return v ? v.data : fix44;
  }, [selectedVersion, versionsList]);

  // Reset page when filtering or version changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedVersion]);

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

  const totalPages = Math.ceil(filteredFields.length / pageSize) || 1;

  // Paginate displayed fields
  const displayedFields = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredFields.slice(start, start + pageSize);
  }, [filteredFields, currentPage, pageSize]);

  // Upload XML dialect
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseQuickFixXml(reader.result);
        if (parsed) {
          localStorage.setItem('fixify-custom-dialect', JSON.stringify(parsed));
          clearCustomDialectCache();
          setCustomDialect(parsed);
          setSelectedVersion(parsed.version);
          setUploadError("");
        }
      } catch (err) {
        setUploadError(err.message || "Failed to parse QuickFIX XML.");
      }
    };
    reader.readAsText(file);
  };

  // Delete custom dialect
  const removeCustomDialect = () => {
    localStorage.removeItem('fixify-custom-dialect');
    clearCustomDialectCache();
    setCustomDialect(null);
    if (selectedVersion === (customDialect?.version || "")) {
      setSelectedVersion("FIX.4.4");
    }
    setUploadError("");
  };

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

      {/* Custom XML Dialect Uploader Card */}
      <div
        className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/10 space-y-4"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-zinc-400">
              Custom XML Dialect Schema
            </h3>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              Upload a QuickFIX XML schema file (e.g. <code>FIX44-Custom.xml</code>) to override standard tag and enum definitions globally.
            </p>
          </div>
          
          <div className="flex items-center gap-3 shrink-0">
            {customDialect ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono" style={{ background: 'var(--background)', border: '1px solid var(--border)' }}>
                <span className="text-emerald-400 font-bold">✓ Active:</span>
                <span className="text-zinc-350">{customDialect.version}</span>
                <button
                  onClick={removeCustomDialect}
                  className="ml-2 hover:text-red-400 text-zinc-500 transition-colors"
                  title="Remove Custom Dialect"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <label className="fx-btn-secondary py-1.5 px-3 cursor-pointer text-xs font-mono flex items-center gap-1.5">
                <Upload className="h-3.5 w-3.5" />
                <span>Upload XML Schema</span>
                <input
                  type="file"
                  accept=".xml"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>
        
        {uploadError && (
          <p className="text-xs text-red-400 font-mono">
            ⚠️ {uploadError}
          </p>
        )}
      </div>

      {/* Toolbar Filter */}
      <div
        className="flex flex-col md:flex-row gap-4 p-4 rounded-2xl items-stretch md:items-center"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search by Tag ID, Field Name, or Data Type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-zinc-950/50 border border-zinc-800 focus:border-[var(--primary)] outline-none rounded-xl text-xs font-mono text-zinc-300 transition-colors"
            style={{ background: 'var(--background)', border: '1px solid var(--border)' }}
          />
        </div>

        {/* Page Size select */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold font-mono text-zinc-500 uppercase tracking-wider shrink-0">Page Size:</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="px-2.5 py-1.5 border border-zinc-850 rounded-xl text-xs font-mono outline-none cursor-pointer text-zinc-350"
            style={{ background: 'var(--background)', border: '1px solid var(--border)' }}
          >
            <option value={30}>30</option>
            <option value={60}>60</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
        </div>

        {/* Version dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold font-mono text-zinc-500 uppercase tracking-wider shrink-0">Protocol Version:</span>
          <select
            value={selectedVersion}
            onChange={(e) => setSelectedVersion(e.target.value)}
            className="px-3.5 py-2 border border-zinc-850 rounded-xl text-xs font-mono outline-none cursor-pointer text-zinc-350 focus:border-[var(--primary)]"
            style={{ background: 'var(--background)', border: '1px solid var(--border)' }}
          >
            {versionsList.map((v) => (
              <option key={v.value} value={v.value}>{v.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats indicators */}
      <div className="flex items-center justify-between text-xs font-mono px-1" style={{ color: 'var(--text-muted)' }}>
        <span>
          Showing {displayedFields.length} of {filteredFields.length} matching tags (Page {currentPage} of {totalPages})
        </span>
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

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-zinc-900 text-xs font-mono text-zinc-500">
          <div>
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="hidden sm:inline-flex items-center justify-center p-2 rounded-lg border border-zinc-850 disabled:opacity-30 disabled:pointer-events-none hover:text-white transition-colors"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
              title="First Page"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-zinc-850 disabled:opacity-30 disabled:pointer-events-none hover:text-white transition-colors flex items-center justify-center"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
              title="Previous Page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            
            {/* Page number indicators */}
            <div className="hidden sm:flex items-center gap-1 max-w-[200px] overflow-x-auto">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(page => Math.abs(page - currentPage) <= 2 || page === 1 || page === totalPages)
                .map((page, idx, arr) => {
                  const isGap = idx > 0 && page - arr[idx - 1] > 1;
                  return (
                    <React.Fragment key={page}>
                      {isGap && <span className="px-1 text-zinc-650">...</span>}
                      <button
                        onClick={() => setCurrentPage(page)}
                        className={`px-2.5 py-1 rounded-md text-xs transition-all ${currentPage === page ? 'bg-[var(--primary)] text-black font-extrabold' : 'hover:bg-zinc-800 text-zinc-400'}`}
                      >
                        {page}
                      </button>
                    </React.Fragment>
                  );
                })}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg border border-zinc-850 disabled:opacity-30 disabled:pointer-events-none hover:text-white transition-colors flex items-center justify-center"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
              title="Next Page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="hidden sm:inline-flex items-center justify-center p-2 rounded-lg border border-zinc-850 disabled:opacity-30 disabled:pointer-events-none hover:text-white transition-colors"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
              title="Last Page"
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Shared Tag Details Modal */}
      {activeTag && (
        <TagDetailsModal
          tag={activeTag}
          version={selectedVersion}
          isOpen={!!activeTag}
          onClose={() => setActiveTag(null)}
          onTagSelect={setActiveTag}
        />
      )}
    </div>
  );
}
