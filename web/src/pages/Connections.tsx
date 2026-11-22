import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { download, qs, useApi } from '../api/client';
import {
  CASE_PRIORITIES, CASE_STATUSES, ORDER_STATUSES, SERVICE_STATUSES,
  Order, OrderUpdateRow, Page, Service, SupportCase,
} from '../api/types';
import { Badge, Icon, Pagination, Sort, Th, authorIcon, fmtDateTime } from '../components/ui';
import { CreateCaseModal } from './modals';

type Tab = 'orders' | 'order-updates' | 'live-service' | 'support-cases';
const TABS: [Tab, ReactNode][] = [
  ['orders', 'Orders'], ['order-updates', 'Order updates'], ['live-service', 'Live service'],
  ['support-cases', <span key="sc" style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>{Icon.lifebuoy()} Support cases</span>],
];
const PAGE_SIZE = 6;

// ---------- shared list state ----------
function useList<F extends Record<string, unknown>>(path: string, initial: F) {
  const [filters, setFilters] = useState<F>(initial);
  const [debounced, setDebounced] = useState<F>(initial);
  const [sort, setSort] = useState<Sort>(null);
  const [page, setPage] = useState(1);
  useEffect(() => { const t = setTimeout(() => setDebounced(filters), 300); return () => clearTimeout(t); }, [filters]);
  useEffect(() => setPage(1), [debounced, sort]);
  const params = useMemo(() => ({ ...debounced, sort: sort?.key, dir: sort?.dir }), [debounced, sort]);
  const list = useApi<Page<unknown>>(`${path}${qs({ ...params, page, pageSize: PAGE_SIZE })}`);
  const set = <K extends keyof F>(k: K, v: F[K]) => setFilters((f) => ({ ...f, [k]: v }));
  return { filters, set, clear: () => setFilters(initial), sort, setSort, page, setPage, list, exportParams: qs(params) };
}

// ---------- layout ----------
function Shell({ tab, onTab, filters, onClear, children }: { tab: Tab; onTab: (t: Tab) => void; filters: ReactNode; onClear: () => void; children: ReactNode }) {
  return (
    <main className="page split">
      <section className="card">
        <header className="card-head"><h2>Filter connections</h2></header>
        <form className="card-body" style={{ padding: '30px 30px 34px' }} onSubmit={(e) => e.preventDefault()}>
          {filters}
          <button type="button" className="btn btn-ghost" onClick={onClear}>Clear filter {Icon.filter()}</button>
        </form>
      </section>
      <section className="card">
        <header className="card-head"><h2>Connections</h2></header>
        <div className="tabs" role="tablist">
          {TABS.map(([k, label]) => (
            <button key={k} role="tab" aria-selected={k === tab} className={`${k === tab ? 'active' : ''} ${k === 'support-cases' ? '' : ''}`} onClick={() => onTab(k)}>{label}</button>
          ))}
        </div>
        <div className="card-body" style={{ padding: '34px 34px 30px' }}>{children}</div>
      </section>
    </main>
  );
}

const Text = ({ label, value, onChange, placeholder = 'Text here...' }: { label: string; value?: string; onChange: (v: string) => void; placeholder?: string }) => (
  <label className="field"><span>{label}</span><input className="input" value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} /></label>
);
const Choice = ({ label, value, options, onChange }: { label: string; value?: string; options: readonly string[]; onChange: (v: string) => void }) => (
  <label className="field"><span>{label}</span>
    <select className="select" value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">Select option</option>
      {options.map((o) => <option key={o}>{o}</option>)}
    </select>
  </label>
);
const Dates = ({ label, from, to, onFrom, onTo }: { label: string; from?: string; to?: string; onFrom: (v: string) => void; onTo: (v: string) => void }) => (
  <div className="field"><span className="label">{label}</span>
    <div className="date-range">
      <input className="input" type="date" aria-label="Start date" value={from ?? ''} max={to || undefined} onChange={(e) => onFrom(e.target.value)} />
      <span>-</span>
      <input className="input" type="date" aria-label="End date" value={to ?? ''} min={from || undefined} onChange={(e) => onTo(e.target.value)} />
    </div>
  </div>
);
function Checks({ label, options, value, onChange }: { label: string; options: readonly (readonly [string, string])[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <fieldset className="field" style={{ border: 0, padding: 0, margin: '0 0 6px' }}>
      <legend className="label">{label}</legend>
      <div className="checks">
        {options.map(([v, text]) => (
          <label className="check" key={v}>
            <input type="checkbox" checked={value.includes(v)} onChange={(e) => onChange(e.target.checked ? [...value, v] : value.filter((x) => x !== v))} />
            {text}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Toolbar({ exportLabel, onExport, onRefresh, extra }: { exportLabel: string; onExport: () => void; onRefresh: () => void; extra?: ReactNode }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="toolbar">
      <button className="btn btn-teal" disabled={busy} onClick={async () => { setBusy(true); try { await onExport(); } finally { setBusy(false); } }}>{exportLabel} {Icon.download()}</button>
      <button className="btn btn-outline" onClick={onRefresh}>Refresh data {Icon.refresh()}</button>
      {extra && <div className="end">{extra}</div>}
    </div>
  );
}

function Rows<T>({ list, cols, render }: { list: { data?: Page<unknown>; loading: boolean; error?: Error }; cols: number; render: (row: T) => ReactNode }) {
  if (list.error) return <tbody><tr><td colSpan={cols} className="empty">Couldn&apos;t load data. Try Refresh data.</td></tr></tbody>;
  if (!list.data) return <tbody><tr><td colSpan={cols}><div className="skeleton" style={{ height: 200 }} /></td></tr></tbody>;
  if (!list.data.items.length) return <tbody><tr><td colSpan={cols} className="empty">No results match these filters.</td></tr></tbody>;
  return <tbody style={{ opacity: list.loading ? 0.55 : 1 }}>{(list.data.items as T[]).map(render)}</tbody>;
}

const Pager = ({ l }: { l: ReturnType<typeof useList> }) =>
  l.list.data ? <Pagination page={l.page} pageSize={PAGE_SIZE} total={l.list.data.total} onPage={l.setPage} /> : null;

// ---------- tabs ----------
function OrdersTab({ shell, address }: { shell: (f: ReactNode, clear: () => void, c: ReactNode) => JSX.Element; address?: string }) {
  const l = useList('/orders', { partnerOrderRef: '', address: address ?? '', location: '', status: '', from: '', to: '' });
  const f = l.filters;
  return shell(
    <>
      <label className="field"><span>Partner order reference</span>
        <div className="prefix"><span>ORD-</span><input className="input" placeholder="Numbers here" inputMode="numeric" value={f.partnerOrderRef} onChange={(e) => l.set('partnerOrderRef', e.target.value.replace(/\D/g, ''))} /></div>
      </label>
      <Text label="Address / Postcode" value={f.address} onChange={(v) => l.set('address', v)} />
      <Text label="Location" value={f.location} onChange={(v) => l.set('location', v)} />
      <Choice label="Status" value={f.status} options={ORDER_STATUSES} onChange={(v) => l.set('status', v)} />
      <Dates label="Date generated" from={f.from} to={f.to} onFrom={(v) => l.set('from', v)} onTo={(v) => l.set('to', v)} />
    </>,
    l.clear,
    <>
      <Toolbar exportLabel="Export orders" onExport={() => download(`/orders.csv${l.exportParams}`)} onRefresh={l.list.reload} />
      <div className="table-wrap"><table>
        <thead><tr>
          <Th label="Location" sortKey="location" sort={l.sort} onSort={l.setSort} />
          <Th label="Postcode" sortKey="postcode" sort={l.sort} onSort={l.setSort} info="Installation address postcode" />
          <Th label="Partner order ref" />
          <Th label="Quote ID" sortKey="quoteId" sort={l.sort} onSort={l.setSort} />
          <Th label="Order reference" />
          <Th label="Product name" sortKey="productName" sort={l.sort} onSort={l.setSort} info="Product ordered" />
          <Th label="Status" sortKey="status" sort={l.sort} onSort={l.setSort} />
          <Th label="Action" />
        </tr></thead>
        <Rows<Order> list={l.list} cols={8} render={(o) => (
          <tr key={o.id}>
            <td>{o.location}</td><td>{o.postcode}</td><td>{o.partnerOrderRef}</td><td>{o.quoteId}</td>
            <td>{o.orderReference}</td><td>{o.productName}</td><td><Badge status={o.status} /></td>
            <td><Link className="btn btn-teal btn-sm" to={`/connections/orders/${o.id}`}>View</Link></td>
          </tr>
        )} />
      </table></div>
      <Pager l={l as never} />
    </>,
  );
}

function UpdatesTab({ shell }: { shell: (f: ReactNode, clear: () => void, c: ReactNode) => JSX.Element }) {
  const l = useList('/order-updates', { orderRef: '', stage: '', status: '', from: '', to: '' });
  // filter options from the Order Status Updates design (states + order line stages)
  const opts = useApi<{ states: string[]; stages: string[] }>('/order-updates/options');
  const f = l.filters;
  return shell(
    <>
      <Text label="Order reference" value={f.orderRef} onChange={(v) => l.set('orderRef', v)} />
      <Choice label="Stage" value={f.stage} options={opts.data?.stages ?? []} onChange={(v) => l.set('stage', v)} />
      <Choice label="Status" value={f.status} options={opts.data?.states ?? []} onChange={(v) => l.set('status', v)} />
      <Dates label="Date generated" from={f.from} to={f.to} onFrom={(v) => l.set('from', v)} onTo={(v) => l.set('to', v)} />
    </>,
    l.clear,
    <>
      <Toolbar exportLabel="Export order updates" onExport={() => download(`/order-updates.csv${l.exportParams}`)} onRefresh={l.list.reload} />
      <div className="table-wrap"><table>
        <thead><tr>
          <Th label="Order reference" sortKey="orderReference" sort={l.sort} onSort={l.setSort} />
          <Th label="Update" sortKey="update" sort={l.sort} onSort={l.setSort} info="Service order this update relates to" />
          <Th label="Stage" sortKey="stage" sort={l.sort} onSort={l.setSort} />
          <Th label="Status" sortKey="status" sort={l.sort} onSort={l.setSort} />
          <Th label="Comment" sortKey="comment" sort={l.sort} onSort={l.setSort} />
          <Th label="Date raised" sortKey="raisedAt" sort={l.sort} onSort={l.setSort} />
          <Th label="Action" />
        </tr></thead>
        <Rows<OrderUpdateRow> list={l.list} cols={7} render={(u) => (
          <tr key={u.id}>
            <td><Link to={`/connections/orders/${u.orderId}`} style={{ color: 'inherit' }}>{u.orderReference}</Link></td>
            <td style={{ maxWidth: 220 }}>{u.update}</td><td>{u.stage}</td><td><Badge status={u.status} /></td>
            <td><div className="comment">{authorIcon(u.authorType)}<span><strong>{u.author} (Additional comments):</strong> {u.comment}</span></div></td>
            <td>{fmtDateTime(u.raisedAt)}</td>
            <td><Link className="btn btn-teal btn-sm" to={`/connections/orders/${u.orderId}`}>View</Link></td>
          </tr>
        )} />
      </table></div>
      <Pager l={l as never} />
    </>,
  );
}

function ServicesTab({ shell }: { shell: (f: ReactNode, clear: () => void, c: ReactNode) => JSX.Element }) {
  const l = useList('/services', { quoteRef: '', serviceRef: '', address: '', location: '', status: '', from: '', to: '' });
  const f = l.filters;
  return shell(
    <>
      <Text label="Quote reference" value={f.quoteRef} onChange={(v) => l.set('quoteRef', v)} />
      <Text label="Service reference" value={f.serviceRef} onChange={(v) => l.set('serviceRef', v)} />
      <Text label="Address / Postcode" value={f.address} onChange={(v) => l.set('address', v)} />
      <Text label="Location" value={f.location} onChange={(v) => l.set('location', v)} />
      <Choice label="Status" value={f.status} options={SERVICE_STATUSES} onChange={(v) => l.set('status', v)} />
      <Dates label="Date generated" from={f.from} to={f.to} onFrom={(v) => l.set('from', v)} onTo={(v) => l.set('to', v)} />
    </>,
    l.clear,
    <>
      <Toolbar exportLabel="Export services" onExport={() => download(`/services.csv${l.exportParams}`)} onRefresh={l.list.reload} />
      <div className="table-wrap"><table>
        <thead><tr>
          <Th label="Location" sortKey="location" sort={l.sort} onSort={l.setSort} />
          <Th label="Postcode" sortKey="postcode" sort={l.sort} onSort={l.setSort} info="Service address postcode" />
          <Th label="Order reference" sortKey="orderReference" sort={l.sort} onSort={l.setSort} />
          <Th label="Service reference" />
          <Th label="Service name" sortKey="serviceName" sort={l.sort} onSort={l.setSort} info="Live product" />
          <Th label="Status" sortKey="status" sort={l.sort} onSort={l.setSort} />
          <Th label="Action" />
        </tr></thead>
        <Rows<Service> list={l.list} cols={7} render={(s) => (
          <tr key={s.id}>
            <td>{s.location}</td><td>{s.postcode}</td><td>{s.orderReference}</td><td>{s.serviceReference}</td>
            <td>{s.serviceName}</td><td><Badge status={s.status} /></td>
            <td><Link className="btn btn-teal btn-sm" to={`/connections/services/${s.id}`}>View</Link></td>
          </tr>
        )} />
      </table></div>
      <Pager l={l as never} />
    </>,
  );
}

function CasesTab({ shell }: { shell: (f: ReactNode, clear: () => void, c: ReactNode) => JSX.Element }) {
  const l = useList('/cases', { caseId: '', serviceRef: '', priorities: [] as string[], statuses: [] as string[], from: '', to: '' });
  const [creating, setCreating] = useState(false);
  const f = l.filters;
  return shell(
    <>
      <Text label="Case ID" value={f.caseId} onChange={(v) => l.set('caseId', v)} />
      <Text label="Service reference" value={f.serviceRef} onChange={(v) => l.set('serviceRef', v)} />
      <Checks label="Priority" options={CASE_PRIORITIES.slice(0, 3)} value={f.priorities} onChange={(v) => l.set('priorities', v)} />
      <Checks label="Status" options={CASE_STATUSES.map((s) => [s, s] as const)} value={f.statuses} onChange={(v) => l.set('statuses', v)} />
      <Dates label="Date raised" from={f.from} to={f.to} onFrom={(v) => l.set('from', v)} onTo={(v) => l.set('to', v)} />
    </>,
    l.clear,
    <>
      <Toolbar
        exportLabel="Export cases" onExport={() => download(`/cases.csv${l.exportParams}`)} onRefresh={l.list.reload}
        extra={<button className="btn btn-teal" onClick={() => setCreating(true)}>Create new case {Icon.chevronRight()}</button>}
      />
      <div className="table-wrap"><table>
        <thead><tr>
          <Th label="Case ID" sortKey="caseNumber" sort={l.sort} onSort={l.setSort} />
          <Th label="Date created" sortKey="createdAt" sort={l.sort} onSort={l.setSort} />
          <Th label="Service reference" />
          <Th label="Case summary" sortKey="summary" sort={l.sort} onSort={l.setSort} />
          <Th label="Status" sortKey="status" sort={l.sort} onSort={l.setSort} />
          <Th label="Priority" />
          <Th label="Partner contact" />
          <Th label="Actions" />
        </tr></thead>
        <Rows<SupportCase> list={l.list} cols={8} render={(c) => (
          <tr key={c.id}>
            <td>{c.caseNumber}</td><td>{fmtDateTime(c.createdAt)}</td><td>{c.serviceReference}</td><td>{c.summary}</td>
            <td><Badge status={c.status} /></td><td>{c.priority}</td><td>{c.partnerContact}</td>
            <td><Link className="btn btn-teal btn-sm" to={`/connections/cases/${c.id}`}>View</Link></td>
          </tr>
        )} />
      </table></div>
      <Pager l={l as never} />
      {creating && <CreateCaseModal onClose={() => setCreating(false)} onCreated={() => { setCreating(false); l.list.reload(); }} />}
    </>,
  );
}

export function Connections() {
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find(([k]) => k === params.get('tab'))?.[0] ?? 'orders') as Tab;
  const onTab = (t: Tab) => setParams({ tab: t });
  const shell = (filters: ReactNode, onClear: () => void, content: ReactNode) => (
    <Shell tab={tab} onTab={onTab} filters={filters} onClear={onClear}>{content}</Shell>
  );
  if (tab === 'order-updates') return <UpdatesTab shell={shell} />;
  if (tab === 'live-service') return <ServicesTab shell={shell} />;
  if (tab === 'support-cases') return <CasesTab shell={shell} />;
  return <OrdersTab key={params.get('address') ?? ''} shell={shell} address={params.get('address') ?? undefined} />;
}
