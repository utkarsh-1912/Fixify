import { XMarkIcon } from "@heroicons/react/24/solid";

function FileModal({ file, onClose }) {
  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl w-[90%] max-w-3xl max-h-[80%] overflow-y-auto flex flex-col animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 bg-zinc-50 dark:bg-zinc-900/50">
          <h2 className="text-md font-bold text-zinc-900 dark:text-zinc-100">📄 {file.name}</h2>
          <button onClick={onClose} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-850 text-zinc-500 hover:text-red-600 transition-all">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        <pre className="p-6 overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs bg-zinc-50/50 dark:bg-zinc-950/20 text-zinc-800 dark:text-zinc-300 flex-1">
          {file.content}
        </pre>
      </div>
    </div>
  );
}

export default FileModal;