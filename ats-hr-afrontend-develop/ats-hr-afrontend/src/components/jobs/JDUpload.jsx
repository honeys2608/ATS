// src/components/jobs/JDUpload.jsx
import React from 'react'

export default function JDUpload({ value, onFile }) {
  // value: optional File or URL preview
  return (
    <div>
      <input
        type="file"
        accept=".pdf,.doc,.docx"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
      {value && typeof value === 'string' && (
        <div style={{ marginTop: 8 }}>
          <a href={value} target="_blank" rel="noreferrer">View uploaded JD</a>
        </div>
      )}
      {value && value.name && (
        <div style={{ marginTop: 8 }}>{value.name}</div>
      )}
    </div>
  )
}
