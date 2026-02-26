import React from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import "./EmailEditor.css";

export default function EmailEditor({
  subject,
  setSubject,
  value,
  setValue,
  attachments,
  setAttachments,
}) {
  const modules = {
    toolbar: [
      [{ header: [1, 2, false] }],
      ["bold", "italic", "underline"],
      [{ list: "ordered" }, { list: "bullet" }],
      [{ indent: "-1" }, { indent: "+1" }],
      [{ align: [] }],
      ["blockquote", "code-block"],
      ["link"],
      ["clean"],
    ],
  };

  function handleFiles(e) {
    const files = Array.from(e.target.files);
    setAttachments((prev) => [...prev, ...files]);
  }

  return (
    <div className="email-editor">
      {/* SUBJECT */}
      <input
        className="email-subject"
        placeholder="Subject"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
      />

      {/* BODY */}
      <ReactQuill
        theme="snow"
        value={value}
        onChange={setValue}
        modules={modules}
        placeholder="Write your email here..."
      />

      {/* ATTACHMENTS */}
      <div className="attachments">
        <label className="attach-btn">
          📎 Attach files
          <input
            type="file"
            multiple
            hidden
            accept=".pdf,.doc,.docx,.txt"
            onChange={handleFiles}
          />
        </label>

        {attachments.map((file, i) => (
          <div key={i} className="attachment-chip">
            <span className="file-name">{file.name}</span>
            <button
              type="button"
              className="remove-attachment"
              onClick={() =>
                setAttachments((prev) => prev.filter((_, idx) => idx !== i))
              }
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
