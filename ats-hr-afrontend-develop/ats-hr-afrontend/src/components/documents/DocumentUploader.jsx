// src/components/documents/DocumentUploader.jsx
import React, { useState } from "react";
import documentService from "../../services/documentService";

export default function DocumentUploader({ employeeId, onUploaded }) {
  const [uploading, setUploading] = useState(false);

  const handle = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await documentService.uploadForEmployee(employeeId, file);
      onUploaded?.();
      alert("Uploaded");
    } catch (err) {
      console.error(err);
      alert("Upload failed");
    } finally {
      setUploading(false);
      e.target.value = ""; // reset input
    }
  };

  return (
    <div>
      <input type="file" onChange={handle} disabled={uploading} />
    </div>
  );
}
