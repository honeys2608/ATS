// src/components/documents/DocumentDownloadButton.jsx
import React from "react";
import documentService from "../../services/documentService";

export default function DocumentDownloadButton({ docId, label = "Download" }) {
  return <button onClick={() => documentService.download(docId)} className="text-blue-600">{label}</button>;
}
