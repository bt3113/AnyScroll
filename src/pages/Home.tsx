import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import UploadDropzone from '../components/UploadDropzone';
import TileCard from '../components/TileCard';
import { SearchIcon } from '../components/icons';
import { initDocsStore, useDocs } from '../lib/docsStore';

export default function Home() {
  const docs = useDocs();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    initDocsStore().then(() => setLoaded(true));
  }, []);

  const continueDoc = docs.find(
    (d) => d.status === 'ready' && d.lastOpenedCard > 0 && d.lastOpenedCard < d.cardCount - 1,
  );
  const recent = docs.filter((d) => !d.archived).slice(0, 6);

  function submitSearch(e: FormEvent) {
    e.preventDefault();
    navigate(`/library${query ? `?q=${encodeURIComponent(query)}` : ''}`);
  }

  return (
    <div className="page page-with-search">
      <header className="home-header">
        <div className="brand">
          <span className="brand-mark" />
          AnyScroll
        </div>
      </header>

      <p className="home-tagline">Any document. A few concise, swipeable cards.</p>

      <div className="fade-scale-in">
        <UploadDropzone />
      </div>

      {continueDoc && (
        <>
          <div className="section-header">
            <h2 className="section-title">Continue reading</h2>
          </div>
          <TileCard doc={continueDoc} highlighted onClick={() => navigate(`/reader/${continueDoc.id}`)} />
        </>
      )}

      <div className="section-header">
        <h2 className="section-title">Recent</h2>
        <span className="meta">{docs.length} total</span>
      </div>

      {loaded && recent.length === 0 && (
        <p className="empty-hint">Nothing yet — upload a document above to see it turned into a scroll.</p>
      )}

      <div className="tile-grid">
        {recent.map((doc, i) => (
          <TileCard
            key={doc.id}
            doc={doc}
            highlighted={i === 0 && doc.status === 'ready'}
            onClick={() => {
              if (doc.status === 'ready') navigate(`/reader/${doc.id}`);
              else navigate('/library');
            }}
          />
        ))}
      </div>

      <form className="search-pill" onSubmit={submitSearch}>
        <SearchIcon size={17} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your documents"
          aria-label="Search your documents"
        />
      </form>

      <style>{`
        .page-with-search {
          padding-bottom: calc(env(safe-area-inset-bottom, 20px) + 150px);
        }
        .home-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: var(--space-2);
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 16px;
          font-weight: 800;
          letter-spacing: -0.02em;
        }
        .brand-mark {
          width: 10px;
          height: 10px;
          border-radius: 3px;
          background: var(--accent);
        }
        .home-tagline {
          margin: 10px 0 var(--space-5);
          font-size: 14px;
          color: var(--text-secondary);
          max-width: 30ch;
        }
        .tile-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .empty-hint {
          font-size: 13.5px;
          color: var(--text-tertiary);
          padding: var(--space-3) 0;
        }
        .search-pill {
          position: fixed;
          left: 50%;
          bottom: 84px;
          transform: translateX(-50%);
          width: calc(100% - 32px);
          max-width: 448px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 13px 18px;
          border-radius: var(--radius-pill);
          background: rgba(31, 31, 35, 0.92);
          backdrop-filter: blur(16px);
          border: 1px solid var(--surface-border);
          color: var(--text-tertiary);
          z-index: 30;
        }
        .search-pill input {
          flex: 1;
          background: none;
          border: none;
          outline: none;
          font-size: 14px;
          color: var(--text-primary);
        }
        .search-pill input::placeholder {
          color: var(--text-tertiary);
        }
      `}</style>
    </div>
  );
}
