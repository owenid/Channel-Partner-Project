import { ReactNode, useEffect } from 'react';
import type { AuthorType } from '../api/types';

// ---------- Icons (inline SVG, currentColor) ----------
const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
export const Icon = {
  chevronDown: (p = 12) => <svg width={p} height={p} viewBox="0 0 24 24" {...s}><path d="M6 9l6 6 6-6" /></svg>,
  chevronRight: (p = 12) => <svg width={p} height={p} viewBox="0 0 24 24" {...s}><path d="M9 6l6 6-6 6" /></svg>,
  chevronLeft: (p = 12) => <svg width={p} height={p} viewBox="0 0 24 24" {...s}><path d="M15 6l-6 6 6 6" /></svg>,
  search: () => <svg width="16" height="16" viewBox="0 0 24 24" {...s}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>,
  eye: () => <svg width="16" height="16" viewBox="0 0 24 24" {...s}><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" /><circle cx="12" cy="12" r="2.5" /></svg>,
  pulse: () => <svg width="24" height="24" viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="10" /><path d="M5 12h3l2-4 3 8 2-4h4" /></svg>,
  download: () => <svg width="13" height="13" viewBox="0 0 24 24" {...s}><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>,
  refresh: () => <svg width="13" height="13" viewBox="0 0 24 24" {...s}><path d="M20 11a8 8 0 0 0-14.9-3M4 13a8 8 0 0 0 14.9 3M4 4v4h4M20 20v-4h-4" /></svg>,
  calendar: () => <svg width="12" height="12" viewBox="0 0 24 24" {...s}><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></svg>,
  pencil: () => <svg width="12" height="12" viewBox="0 0 24 24" {...s}><path d="M4 20h4L19 9l-4-4L4 16v4z" /></svg>,
  xCircle: () => <svg width="12" height="12" viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="9" /><path d="M9 9l6 6M15 9l-6 6" /></svg>,
  reply: () => <svg width="12" height="12" viewBox="0 0 24 24" {...s}><path d="M10 6L4 12l6 6M4 12h10a6 6 0 0 1 6 6" /></svg>,
  filter: () => <svg width="14" height="14" viewBox="0 0 24 24" {...s}><path d="M4 7h16M7 12h13M10 17h10" /></svg>,
  lifebuoy: () => <svg width="18" height="18" viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><path d="M5.6 5.6l3.6 3.6M14.8 14.8l3.6 3.6M18.4 5.6l-3.6 3.6M9.2 14.8l-3.6 3.6" /></svg>,
  send: () => <svg width="16" height="16" viewBox="0 0 24 24" {...s}><path d="M21 3L10 14M21 3l-7 18-4-7-7-4 18-7z" /></svg>,
  check: (p = 16) => <svg width={p} height={p} viewBox="0 0 24 24" {...s} strokeWidth={2.5}><path d="M5 12l5 5 9-10" /></svg>,
  user: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0z" /></svg>,
  agent: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M2 12l18-8-6 18-3-7-9-3z" /></svg>,
  system: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="7" width="16" height="11" rx="3" /><rect x="11" y="3" width="2" height="4" /><circle cx="9" cy="12.5" r="1.4" fill="#fff" /><circle cx="15" cy="12.5" r="1.4" fill="#fff" /></svg>,
};

export const authorIcon = (t: AuthorType) => (t === 'customer' ? Icon.user() : t === 'system' ? Icon.system() : Icon.agent());

// ---------- Logo ----------
export function Logo() {
  return (
    <a className="logo" href="/" aria-label="Giganet home">
      Giganet
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden>
        <path d="M6 4h12v12l-4-4V8H10z" fill="#4bb7c4" />
        <path d="M2 10l6-6v4z" fill="#8fd3dc" />
        <path d="M14 22l6-6h-4z" fill="#8fd3dc" />
      </svg>
    </a>
  );
}

// ---------- Card ----------
export function Card({ title, help, action, children, className = '', bodyClass = '' }: {
  title: ReactNode; help?: boolean; action?: ReactNode; children: ReactNode; className?: string; bodyClass?: string;
}) {
  return (
    <section className={`card ${className}`}>
      <header className="card-head">
        <h2>{title}</h2>
        {action}
        {help && <button className="help" title="Help" aria-label="Help">?</button>}
      </header>
      <div className={`card-body ${bodyClass}`}>{children}</div>
    </section>
  );
}

// ---------- Status badge ----------
const badgeMap: Record<string, [string, string]> = {
  'In progress': ['b-green', '↗'], Operational: ['b-green', '⌔'], Resolved: ['b-green', '✓'],
  Suspended: ['b-orange', '⏸'], 'On hold': ['b-orange', '●'], 'On hold - scheduled': ['b-orange', '●'],
  Cancelled: ['b-red', '✕'], Rejected: ['b-red', '✕'], Offline: ['b-red', '✕'],
  'Awaiting information': ['b-amber', '◷'], 'Awaiting customer': ['b-amber', '◷'], 'Awaiting supplier': ['b-amber', '◷'],
  Scheduled: ['b-blue', '▣'], Acknowledged: ['b-blue', '✓'], New: ['b-blue', '✓'],
  Completed: ['b-green', '✓'], 'Alt status': ['b-dark', ''],
  // quote availability (Check FTTP Availability design)
  Available: ['b-green', '✓'], 'Pre-Order': ['b-blue', '◷'], 'Coming-Soon': ['b-amber', '◷'], ComingSoon: ['b-amber', '◷'],
  'Register-Interest': ['b-dark', '☆'], 'Not available': ['b-red', '✕'],
  // order states (Order Status Updates design)
  Delayed: ['b-orange', '◷'], 'On Hold': ['b-orange', '●'], Canceled: ['b-red', '✕'], Draft: ['b-dark', ''],
  'Revision in Progress': ['b-amber', '↻'], 'Awaiting Information': ['b-amber', '◷'],
  'Assessing Cancellation': ['b-orange', '◷'], 'Cancellation in Progress': ['b-orange', '◷'],
};
export function Badge({ status }: { status: string }) {
  const [cls, glyph] = badgeMap[status] ?? ['b-dark', ''];
  return <span className={`badge ${cls}`}>{glyph && <span aria-hidden>{glyph}</span>}{status}</span>;
}

// ---------- Sortable header ----------
export type Sort = { key: string; dir: 'asc' | 'desc' } | null;
export function Th({ label, sortKey, sort, onSort, info }: { label: string; sortKey?: string; sort?: Sort; onSort?: (s: Sort) => void; info?: string }) {
  if (!sortKey || !onSort) return <th>{label}{info && <> <span className="info-dot" title={info}>i</span></>}</th>;
  const active = sort?.key === sortKey ? sort.dir : null;
  const next = (): Sort => (active === 'asc' ? { key: sortKey, dir: 'desc' } : active === 'desc' ? null : { key: sortKey, dir: 'asc' });
  return (
    <th aria-sort={active === 'asc' ? 'ascending' : active === 'desc' ? 'descending' : 'none'}>
      <button className="sort" onClick={() => onSort(next())}>
        {label}
        {info && <span className="info-dot" title={info}>i</span>}
        <span className="sort-icon" aria-hidden>
          <svg width="8" height="5" viewBox="0 0 8 5" className={active === 'asc' ? 'on' : ''}><path d="M4 0l4 5H0z" fill="currentColor" /></svg>
          <svg width="8" height="5" viewBox="0 0 8 5" className={active === 'desc' ? 'on' : ''} style={{ marginTop: 2 }}><path d="M4 5L0 0h8z" fill="currentColor" /></svg>
        </span>
      </button>
    </th>
  );
}

// ---------- Pagination ----------
export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = Math.min(Math.max(1, page - 1), Math.max(1, pages - 2));
  const nums = Array.from({ length: Math.min(3, pages) }, (_, i) => start + i);
  return (
    <nav className="pager" aria-label="Pagination">
      <button className="wide" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
      {nums.map((n) => (
        <button key={n} className={n === page ? 'current' : ''} aria-current={n === page ? 'page' : undefined} onClick={() => onPage(n)}>{n}</button>
      ))}
      <button className="wide" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
      <span className="count">{total} results found</span>
    </nav>
  );
}

// ---------- Modal ----------
export function Modal({ title, onClose, children, width }: { title: string; onClose: () => void; children: ReactNode; width?: number }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);
  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} style={width ? { width: `min(${width}px, 100%)` } : undefined}>
        <header className="card-head"><h2>{title}</h2><button className="close" onClick={onClose} aria-label="Close">X</button></header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

// ---------- Read-only field ----------
export const RO = ({ label, value, tall }: { label: string; value?: ReactNode; tall?: boolean }) => (
  <div><label>{label}</label><div className={`ro ${tall ? 'tall' : ''}`}>{value || ' '}</div></div>
);

// ---------- Formatting ----------
const pad = (n: number) => String(n).padStart(2, '0');
export const fmtDate = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};
export const fmtDateTime = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${fmtDate(iso)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const fmtTimeDate = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
};
