import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Icon, Logo } from './ui';
import { useLogout } from '../auth';
import { useApi } from '../api/client';

function Dropdown({ label, to, items, highlight = true }: { label: string; to: string; items: [string, string][]; highlight?: boolean }) {
  return (
    <div className="nav-item">
      {highlight ? <NavLink to={to}>{label} {Icon.chevronDown()}</NavLink> : <Link to={to}>{label} {Icon.chevronDown()}</Link>}
      <div className="menu">{items.map(([text, href]) => <Link key={href} to={href}>{text}</Link>)}</div>
    </div>
  );
}

export function Header() {
  const me = useApi<{ name: string }>('/me');
  const logout = useLogout();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Logo />
        <nav className="nav" aria-label="Main">
          <div className="nav-item"><NavLink to="/" end>Home</NavLink></div>
          <div className="nav-item"><NavLink to="/connections">Connections</NavLink></div>
          <Dropdown label="Quotes" to="/quotes" items={[['New quote', '/quotes/new'], ['My quotes', '/quotes']]} />
          <Dropdown label="Resources" to="/resources" items={[['Quick guides', '/resources?tab=quick-guides'], ['Legal', '/resources?tab=legal'], ['Training', '/resources?tab=training']]} />
          <Dropdown label="Support" highlight={false} to="/connections?tab=support-cases" items={[['Support cases', '/connections?tab=support-cases'], ['Contact us', '/']]} />
        </nav>
        <div className="top-right">
          <form className="search" role="search" onSubmit={(e) => { e.preventDefault(); if (q.trim()) navigate(`/connections?tab=orders&address=${encodeURIComponent(q.trim())}`); }}>
            <input placeholder="Search portal..." value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search portal" />
            <button type="submit" style={{ background: 'none', border: 0, color: 'var(--muted)' }} aria-label="Search">{Icon.search()}</button>
          </form>
          <a className="status-link" href="#status">{Icon.pulse()} STATUS</a>
          <div style={{ position: 'relative' }} onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setOpen(false)}>
            <button className="user-chip" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu">
              <span className="avatar">{(me.data?.name ?? 'G')[0]}</span>
              Hi, {me.data?.name ?? '…'}
              {Icon.chevronDown()}
            </button>
            {open && (
              <div className="menu" role="menu" style={{ display: 'block', top: 46, left: 'auto', right: 0 }}>
                <Link to="/" onClick={() => setOpen(false)}>My profile</Link>
                <a href="#logout" onClick={(e) => { e.preventDefault(); logout(); }}>Log out</a>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export const FeedbackTab = () => <button className="feedback-tab" onClick={() => alert('Feedback form goes here')}>Feedback</button>;
