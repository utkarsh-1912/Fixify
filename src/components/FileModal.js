import { XMarkIcon } from "@heroicons/react/24/solid";

function FileModal({ file, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
      <div className="bg-white rounded shadow-xl w-[90%] max-h-[80%] overflow-y-auto">
        <div className="flex justify-between items-center border-b px-4 py-2">
          <h2 className="text-lg font-semibold">📄 {file.name}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-red-600">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        <pre className="p-4 whitespace-pre-wrap break-words font-mono text-sm bg-gray-50">
          {file.content}
        </pre>
      </div>
    </div>
  );
}

export default FileModal;