import { XMarkIcon } from "@heroicons/react/24/solid";

function FileModal({ file, onClose }) {
  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="rounded-2xl shadow-2xl w-[90%] max-w-3xl max-h-[80%] overflow-y-auto flex flex-col animate-in fade-in zoom-in-95 duration-200 border animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--card)',
          borderColor: 'var(--border)'
        }}
      >
        <div 
          className="flex justify-between items-center border-b px-6 py-4 shrink-0"
          style={{ borderColor: 'var(--border)', background: 'var(--background)' }}
        >
          <h2 className="text-md font-bold" style={{ color: 'var(--foreground)' }}>📄 {file.name}</h2>
          <button 
            onClick={onClose} 
            className="h-8 w-8 rounded-lg flex items-center justify-center transition-all hover:bg-zinc-800/10 dark:hover:bg-zinc-800/40"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        <pre 
          className="p-6 overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs flex-1"
          style={{ background: 'var(--background)', color: 'var(--foreground)' }}
        >
          {file.content}
        </pre>
      </div>
    </div>
  );
}

export default FileModal;