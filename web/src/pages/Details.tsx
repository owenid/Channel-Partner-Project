import { ReactNode, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApi } from '../api/client';
import type { CaseDetail, OrderDetail, ServiceDetail } from '../api/types';
import { Badge, Icon, Pagination, RO, Sort, Th, authorIcon, fmtDate, fmtDateTime } from '../components/ui';
import { AmendContactModal, AmendDateModal, CommentModal, ReasonModal } from './modals';

const UPDATES_PAGE = 5;
const STAGES = ['Order placed', 'Order Acknowledged', 'Installation Scheduled', 'Order operational'];
const stageIcons = [Icon.send(), Icon.check(), Icon.calendar(), Icon.check()];

function Frame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="page">
      <section className="card">
        <header className="card-head"><h2>{title}</h2></header>
        <div className="card-body" style={{ padding: '22px 22px 28px' }}>{children}</div>
      </section>
    </main>
  );
}

function Loading({ error, back }: { error?: Error; back: string }) {
  return (
    <Frame title={error ? 'Not found' : 'Loading…'}>
      {error ? <p>{error.message}. <Link to={back}>Back to connections</Link></p> : <div className="skeleton" style={{ height: 300 }} />}
    </Frame>
  );
}

/** Client-side sort + paging for the update tables on detail pages. */
function usePagedSorted<T>(rows: T[]) {
  const [sort, setSort] = useState<Sort>(null);
  const [page, setPage] = useState(1);
  const sorted = sort
    ? [...rows].sort((a, b) => String((a as never)[sort.key]).localeCompare(String((b as never)[sort.key]), 'en', { numeric: true }) * (sort.dir === 'asc' ? 1 : -1))
    : rows;
  return { sort, setSort: (s: Sort) => { setSort(s); setPage(1); }, page, setPage, items: sorted.slice((page - 1) * UPDATES_PAGE, page * UPDATES_PAGE), total: rows.length };
}

const SubTabs = ({ label }: { label: string }) => (
  <div className="tabs" style={{ margin: '0 -22px' }}><button className="active">{label}</button></div>
);

// ---------- Order ----------
export function OrderPage() {
  const { id } = useParams();
  const o = useApi<OrderDetail>(`/orders/${id}`);
  const [modal, setModal] = useState<'date' | 'contact' | 'cancel' | 'comment' | null>(null);
  const [toast, setToast] = useState<string>();
  const p = usePagedSorted(o.data?.updates ?? []);
  if (!o.data) return <Loading error={o.error} back="/connections" />;
  const d = o.data;
  const done = (msg: string) => (r: unknown) => { o.setData(r as OrderDetail); setModal(null); setToast(msg); setTimeout(() => setToast(undefined), 3500); };

  return (
    <Frame title={`${d.orderReference} - ${d.customerName}`}>
      <div className="toolbar">
        <button className="btn btn-teal btn-sm" style={{ height: 36 }} disabled={!d.cancellable} onClick={() => setModal('date')}>Amend installation date {Icon.calendar()}</button>
        <button className="btn btn-teal btn-sm" style={{ height: 36 }} disabled={!d.cancellable} onClick={() => setModal('contact')}>Amend install contact details {Icon.pencil()}</button>
        <div className="end"><button className="btn btn-red btn-sm" style={{ height: 36 }} disabled={!d.cancellable} onClick={() => setModal('cancel')}>Cancel order {Icon.xCircle()}</button></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 24, marginBottom: 38 }}>
        <div className="panel"><h3>Location info</h3>
          <div className="ro-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <RO label="Address" value={d.address} /><RO label="Postcode" value={d.postcode} /><RO label="City" value={d.city} />
          </div>
        </div>
        <div className="panel"><h3>Order details</h3>
          <div className="ro-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            <RO label="Order reference" value={d.orderReference} />
            <RO label="Date placed" value={fmtDateTime(d.datePlaced)} />
            <RO label="Appointment date" value={d.appointment ? `${fmtDate(d.appointment.date)} ${d.appointment.slot}` : ''} />
            <RO label="Last name" value={d.contact.lastName} />
            <RO label="First name" value={d.contact.firstName} />
            <RO label="Telephone number" value={d.contact.telephone} />
          </div>
        </div>
      </div>

      <div className="stepper" aria-label="Order progress">
        {STAGES.map((s, i) => (
          <div key={s} className={`step ${i <= d.stageIndex && d.status !== 'Cancelled' ? 'done' : ''}`} aria-current={i === d.stageIndex ? 'step' : undefined}>
            <span className="circle">{stageIcons[i]}</span>{s}
          </div>
        ))}
      </div>
      <SubTabs label="Order updates" />
      <div style={{ paddingTop: 22 }}>
        <div className="toolbar"><button className="btn btn-teal btn-sm" style={{ height: 36 }} onClick={() => setModal('comment')}>{Icon.reply()} Add comment to order</button></div>
        <div className="table-wrap"><table>
          <thead><tr>
            <Th label="Date raised" />
            <Th label="Update" sortKey="update" sort={p.sort} onSort={p.setSort} info="Service order this update relates to" />
            <Th label="Status" sortKey="status" sort={p.sort} onSort={p.setSort} />
            <Th label="Comment" sortKey="comment" sort={p.sort} onSort={p.setSort} />
          </tr></thead>
          <tbody>{p.items.map((u) => (
            <tr key={u.id}>
              <td style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(u.raisedAt)}</td><td>{u.update}</td><td><Badge status={u.status} /></td>
              <td><div className="comment">{authorIcon(u.authorType)}<span><strong>{u.author} (Additional comments):</strong> {u.comment}</span></div></td>
            </tr>
          ))}</tbody>
        </table></div>
        <Pagination page={p.page} pageSize={UPDATES_PAGE} total={p.total} onPage={p.setPage} />
      </div>

      {modal === 'date' && <AmendDateModal order={d} onClose={() => setModal(null)} onDone={done('Appointment change requested')} />}
      {modal === 'contact' && <AmendContactModal order={d} onClose={() => setModal(null)} onDone={done('Install contact updated')} />}
      {modal === 'cancel' && <ReasonModal title="Order cancellation" label="Reason for cancelling" path={`/orders/${d.id}/cancel`} onClose={() => setModal(null)} onDone={done('Cancellation requested')} />}
      {modal === 'comment' && <CommentModal title="Add comment to order" path={`/orders/${d.id}/comments`} onClose={() => setModal(null)} onDone={done('Comment added')} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </Frame>
  );
}

// ---------- Live service ----------
export function ServicePage() {
  const { id } = useParams();
  const s = useApi<ServiceDetail>(`/services/${id}`);
  const [cease, setCease] = useState(false);
  const [toast, setToast] = useState<string>();
  const [shown, setShown] = useState(false);
  if (!s.data) return <Loading error={s.error} back="/connections?tab=live-service" />;
  const d = s.data;
  const copy = (v: string) => navigator.clipboard?.writeText(v).then(() => { setToast('Copied'); setTimeout(() => setToast(undefined), 1500); });

  return (
    <Frame title={`${d.serviceReference} - ${d.serviceName}`}>
      <div className="toolbar">
        <Link className="btn btn-teal btn-sm" style={{ height: 36 }} to={`/connections?tab=support-cases`}>Raise a support case {Icon.chevronRight()}</Link>
        <div className="end"><button className="btn btn-red btn-sm" style={{ height: 36 }} disabled={d.status === 'Alt status'} onClick={() => setCease(true)}>Cease service {Icon.xCircle()}</button></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 24, marginBottom: 30 }}>
        <div className="panel"><h3>Connection info</h3>
          <div className="ro-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <RO label="Radius username" value={<span style={{ display: 'flex', width: '100%' }}>{d.radiusUsername}<button className="help" style={{ marginLeft: 'auto', background: 'none' }} onClick={() => copy(d.radiusUsername)} aria-label="Copy">⧉</button></span>} />
            <RO label="IPv4" value={d.ipv4} />
            <RO label="Radius password" value={<span style={{ display: 'flex', width: '100%' }}>{shown ? 'Managed in ServiceNow' : '••••••••••'}<button className="help" style={{ marginLeft: 'auto', background: 'none' }} onClick={() => setShown(!shown)} aria-label="Show">👁</button></span>} />
            <RO label="IPv6" value={d.ipv6} />
            <RO label="Status" value={<span style={{ color: d.online ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>{d.online ? 'Online' : 'Offline'}</span>} />
          </div>
        </div>
        <div className="panel"><h3>Location info</h3>
          <div className="ro-grid"><RO label="Address" value={d.address} /><RO label="Postcode" value={d.postcode} /><RO label="City" value={d.city} /></div>
        </div>
        <div className="panel"><h3>Order details</h3>
          <div className="ro-grid"><RO label="Order reference" value={d.orderReference} /><RO label="Quote reference" value={d.quoteReference} /><RO label="Status" value={<Badge status={d.status} />} /></div>
        </div>
      </div>
      {d.radiusSessions.length === 0 && (
        <div className="empty" style={{ color: 'var(--muted)' }}>
          <div style={{ color: 'var(--red)', fontSize: 26 }}>ⓘ</div>
          <strong>No radius sessions available</strong>
          <div style={{ fontSize: 11 }}>Sessions will appear when available</div>
        </div>
      )}
      {cease && (
        <ReasonModal title="Cease service" label="Cease Reason" product={d.serviceName} path={`/services/${d.id}/cease`}
          onClose={() => setCease(false)}
          onDone={() => { setCease(false); s.reload(); setToast('Cease requested'); setTimeout(() => setToast(undefined), 3500); }} />
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </Frame>
  );
}

// ---------- Support case ----------
export function CasePage() {
  const { id } = useParams();
  const c = useApi<CaseDetail>(`/cases/${id}`);
  const [respond, setRespond] = useState(false);
  const p = usePagedSorted(c.data?.updates ?? []);
  if (!c.data) return <Loading error={c.error} back="/connections?tab=support-cases" />;
  const d = c.data;
  return (
    <Frame title={`Support case #${d.caseNumber}`}>
      <div className="panel" style={{ marginBottom: 30, marginTop: 8 }}><h3>Case details</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 2.2fr', gap: '0 30px' }}>
          <div className="ro-grid"><RO label="Case ID" value={`#${d.caseNumber}`} /><RO label="Priority" value={d.priority} /></div>
          <div className="ro-grid"><RO label="Last updated" value={fmtDate(d.lastUpdated)} /><RO label="Partner contact" value={d.partnerContact} /></div>
          <div className="ro-grid"><RO label="Resolved date" value={fmtDate(d.resolvedAt)} /><RO label="Status" value={<Badge status={d.status} />} /></div>
          <div className="ro-grid"><RO label="Case description" value={d.description} tall /></div>
        </div>
      </div>
      <SubTabs label="Case updates" />
      <div style={{ paddingTop: 30 }}>
        <div className="toolbar"><button className="btn btn-teal btn-sm" style={{ height: 38 }} disabled={d.status === 'Resolved'} onClick={() => setRespond(true)}>{Icon.reply()} Respond to case</button></div>
        <div className="table-wrap"><table>
          <thead><tr>
            <Th label="Updated" sortKey="updatedAt" sort={p.sort} onSort={p.setSort} />
            <Th label="Case summary" sortKey="summary" sort={p.sort} onSort={p.setSort} />
            <Th label="Status" sortKey="status" sort={p.sort} onSort={p.setSort} />
            <Th label="Comment / update" />
            <Th label="Case updated by" />
          </tr></thead>
          <tbody>{p.items.map((u) => (
            <tr key={u.id}>
              <td style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(u.updatedAt)}</td><td>{u.summary}</td><td><Badge status={u.status} /></td>
              <td><div className="comment">{authorIcon(u.authorType)}<span><strong>{u.author} (Additional comments):</strong> {u.comment}</span></div></td>
              <td>{u.updatedBy}</td>
            </tr>
          ))}</tbody>
        </table></div>
        <Pagination page={p.page} pageSize={UPDATES_PAGE} total={p.total} onPage={p.setPage} />
      </div>
      {respond && <CommentModal title="Respond to case" path={`/cases/${d.id}/comments`} onClose={() => setRespond(false)} onDone={(r) => { c.setData(r as CaseDetail); setRespond(false); }} />}
    </Frame>
  );
}
