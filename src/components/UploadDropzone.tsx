import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ingestFile, UnsupportedFileError } from '../lib/ingest';
import { persistDoc, reportDocUpdate } from '../lib/docsStore';
import { UploadIcon } from './icons';

export default function UploadDropzone() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    const list = Array.from(files);
    let firstId: string | null = null;

    for (const file of list) {
      try {
        const doc = await ingestFile(file, (updated) => reportDocUpdate(updated));
        await persistDoc(doc);
        if (!firstId) firstId = doc.id;
      } catch (err) {
        if (err instanceof UnsupportedFileError) {
          setError(`"${file.name}" isn't a supported format (PDF, DOCX, TXT, MD).`);
        } else {
          setError('Something went wrong reading that file.');
        }
      }
    }

    if (firstId && list.length === 1) {
      navigate('/library');
    }
  }

  return (
    <div>
      <button
        type="button"
        className={`dropzone${dragging ? ' dragging' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        <div className="dropzone-icon">
          <UploadIcon size={26} />
        </div>
        <div className="dropzone-text">
          <strong>Drop a document, or tap to upload</strong>
          <span>PDF · DOCX · TXT · MD</span>
        </div>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.txt,.md,application/pdf"
        multiple
        className="visually-hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
      {error && <p className="dropzone-error">{error}</p>}
      <style>{`
        .dropzone {
          width: 100%;
          display: flex;
          align-items: center;
          gap: var(--space-4);
          padding: var(--space-5);
          border-radius: var(--radius-lg);
          background: linear-gradient(155deg, var(--bg-elevated-2), var(--bg-elevated));
          border: 1.5px dashed rgba(215, 255, 61, 0.35);
          text-align: left;
          transition: border-color 0.2s var(--ease-out), transform 0.2s var(--ease-out), background 0.2s var(--ease-out);
        }
        .dropzone:active {
          transform: scale(0.99);
        }
        .dropzone.dragging {
          border-color: var(--accent);
          background: linear-gradient(155deg, var(--bg-elevated-2), var(--accent-soft));
        }
        .dropzone-icon {
          flex-shrink: 0;
          width: 52px;
          height: 52px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--accent);
          color: var(--accent-ink);
        }
        .dropzone-text {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .dropzone-text strong {
          font-size: 15.5px;
          font-weight: 700;
          letter-spacing: -0.01em;
        }
        .dropzone-text span {
          font-size: 12.5px;
          color: var(--text-tertiary);
          letter-spacing: 0.02em;
        }
        .dropzone-error {
          margin: var(--space-2) 2px 0;
          font-size: 12.5px;
          color: var(--danger);
        }
      `}</style>
    </div>
  );
}
