import { NavLink, useLocation } from 'react-router-dom';

const HomeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path
      d="M4 11.5 12 4l8 7.5M6 10v9a1 1 0 0 0 1 1h3v-5a2 2 0 0 1 2-2v0a2 2 0 0 1 2 2v5h3a1 1 0 0 0 1-1v-9"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const LibraryIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <rect x="4" y="5" width="16" height="4.5" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
    <rect x="4" y="11.5" width="16" height="4.5" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
    <rect x="4" y="18" width="10" height="1.6" rx="0.8" fill="currentColor" />
  </svg>
);

export default function NavBar() {
  const location = useLocation();
  if (location.pathname.startsWith('/reader')) return null;

  return (
    <nav className="navbar">
      <NavLink to="/" end className={({ isActive }) => `navbar-item${isActive ? ' active' : ''}`}>
        <HomeIcon />
        <span>Home</span>
      </NavLink>
      <NavLink to="/library" className={({ isActive }) => `navbar-item${isActive ? ' active' : ''}`}>
        <LibraryIcon />
        <span>Library</span>
      </NavLink>
      <style>{`
        .navbar {
          position: fixed;
          left: 50%;
          transform: translateX(-50%);
          bottom: max(16px, env(safe-area-inset-bottom));
          display: flex;
          gap: 4px;
          background: rgba(23, 23, 26, 0.9);
          backdrop-filter: blur(16px);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-pill);
          padding: 6px;
          z-index: 40;
          box-shadow: var(--shadow-card);
          width: calc(100% - 32px);
          max-width: 448px;
        }
        .navbar-item {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 11px 0;
          border-radius: var(--radius-pill);
          color: var(--text-tertiary);
          font-size: 13px;
          font-weight: 600;
          transition: color 0.2s var(--ease-out), background 0.2s var(--ease-out);
        }
        .navbar-item.active {
          color: var(--accent-ink);
          background: var(--accent);
        }
      `}</style>
    </nav>
  );
}
