// src/components/documents/DocumentList.jsx
import React from "react";
import documentService from "../../services/documentService";

export default function DocumentList({ documents = [], onDeleted }) {
  return (
    <div className="space-y-3">
      {documents.map((doc) => (
        <div key={doc.id} className="flex items-center justify-between border p-3 rounded">
          <div>
            <div className="font-medium">{doc.file_name || doc.name}</div>
            <div className="text-xs text-gray-500">{doc.category || doc.type}</div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => documentService.download(doc.id)} className="text-blue-600 text-sm">Download</button>
            <button onClick={async () => { await documentService.remove(doc.id); onDeleted?.(); }} className="text-red-600 text-sm">Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}
