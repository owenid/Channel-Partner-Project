import { FormEvent, ReactNode, useState } from 'react';
import { api, useApi } from '../api/client';
import { CANCELLATION_REASONS, CaseDetail, OrderDetail, AccountProfile, AppointmentSlot } from '../api/types';
import { Icon, Modal } from '../components/ui';
import { SlotPicker, slotLabel } from '../components/SlotPicker';

/** Submit helper: tracks busy/error state around an API call. */
function useSubmit<T>(fn: () => Promise<T>, onDone: (r: T) => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    setBusy(true); setError(undefined);
    try { onDone(await fn()); } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };
  return { busy, error, submit };
}

const Foot = ({ onBack, busy, label, disabled }: { onBack?: () => void; busy: boolean; label: string; disabled?: boolean }) => (
  <div className="modal-foot">
    {onBack ? <button type="button" className="btn btn-ghost" onClick={onBack}>{Icon.chevronLeft()} Back</button> : <span />}
    <button type="submit" className="btn btn-teal" disabled={busy || disabled}>{busy ? 'Submitting…' : label} {Icon.chevronRight()}</button>
  </div>
);

// ---------- Orders ----------
/**
 * Amend installation date: slots come from GIG (Engineer Appointments design); submitting
 * reserves the chosen slot against the order (Order Placement design, "Amend Install Date").
 */
export function AmendDateModal({ order, onClose, onDone }: { order: OrderDetail; onClose: () => void; onDone: (o: OrderDetail) => void }) {
  const [chosen, setChosen] = useState<AppointmentSlot | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const s = useSubmit(() => api<OrderDetail>(`/orders/${order.id}/appointment`, { method: 'POST', body: { ...chosen, confirmed } }), onDone);
  const slot = chosen ? slotLabel(chosen) : order.appointment?.label;
  return (
    <Modal title="Amend installation date" onClose={onClose} width={900}>
      <form onSubmit={s.submit}>
        <span className="label">Preferred appointment</span>
        <SlotPicker productType={order.productType || 'fttp'} addressKey={order.addressKey} productCode={order.productCode} postcode={order.postcode} value={chosen} onChange={setChosen} />
        <hr />
        <h3 style={{ font: '700 14px var(--body)', marginBottom: 16 }}>Order information</h3>
        <dl className="dl" style={{ gridTemplateColumns: '135px 1fr', rowGap: 8 }}>
          <dt>Product:</dt><dd>{order.productName}</dd>
          <dt>Supplier:</dt><dd>{order.supplier}</dd>
          <dt>Address:</dt><dd>{order.address}, {order.city}, {order.postcode}</dd>
          <dt>Selected slot:</dt><dd>{slot ?? '—'}</dd>
        </dl>
        <hr />
        <label className="check"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /> I confirm that the details are correct</label>
        {s.error && <p className="error-text" style={{ marginTop: 16 }}>{s.error}</p>}
        <Foot onBack={onClose} busy={s.busy} label="Submit reservation" disabled={!confirmed || !chosen} />
      </form>
    </Modal>
  );
}

export function AmendContactModal({ order, onClose, onDone }: { order: OrderDetail; onClose: () => void; onDone: (o: OrderDetail) => void }) {
  const [c, setC] = useState(order.contact);
  const s = useSubmit(() => api<OrderDetail>(`/orders/${order.id}/contact`, { method: 'POST', body: c }), onDone);
  const field = (k: keyof typeof c, label: string, type = 'text') => (
    <label className="field"><span>{label}</span><input className="input" type={type} required value={c[k]} onChange={(e) => setC({ ...c, [k]: e.target.value })} /></label>
  );
  return (
    <Modal title="Amend install contact details" onClose={onClose}>
      <form onSubmit={s.submit}>
        <div className="form-grid">
          {field('firstName', 'First name')}
          {field('lastName', 'Last name')}
          {field('telephone', 'Telephone number', 'tel')}
        </div>
        {s.error && <p className="error-text">{s.error}</p>}
        <Foot onBack={onClose} busy={s.busy} label="Save contact" />
      </form>
    </Modal>
  );
}

/** Order cancellation and service cease share the reason list from the design. */
export function ReasonModal({ title, label, product, path, onClose, onDone }: {
  title: string; label: string; product?: string; path: string; onClose: () => void; onDone: (r: unknown) => void;
}) {
  const [reason, setReason] = useState('');
  const [sure, setSure] = useState(false);
  const s = useSubmit(() => api(path, { method: 'POST', body: { reason } }), onDone);
  return (
    <Modal title={title} onClose={onClose} width={product ? 860 : 890}>
      <form onSubmit={(e) => { e.preventDefault(); if (!sure) setSure(true); else s.submit(); }}>
        <div className="form-grid">
          <label className="field"><span>{label}</span>
            <select className="select" required value={reason} onChange={(e) => { setReason(e.target.value); setSure(false); }}>
              <option value="">Select option</option>
              {CANCELLATION_REASONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </label>
          {product && <label className="field"><span>Current product</span><input className="input" readOnly value={product} /></label>}
        </div>
        {product && <hr style={{ margin: '10px 0 0' }} />}
        {sure && <p className="error-text" style={{ marginTop: 16 }}>This can&apos;t be undone from the portal. Select Proceed again to confirm.</p>}
        {s.error && <p className="error-text">{s.error}</p>}
        <Foot busy={s.busy} label={sure ? 'Confirm' : 'Proceed'} disabled={!reason} />
      </form>
    </Modal>
  );
}

export function CommentModal({ title, path, onClose, onDone, cta = 'Send', label = 'Comment' }: {
  title: string; path: string; onClose: () => void; onDone: (r: unknown) => void; cta?: string; label?: string;
}) {
  const [comment, setComment] = useState('');
  const s = useSubmit(() => api(path, { method: 'POST', body: { comment } }), onDone);
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={s.submit}>
        <label className="field"><span>{label}</span><textarea className="textarea input" required maxLength={2000} placeholder="Text here" value={comment} onChange={(e) => setComment(e.target.value)} /></label>
        {s.error && <p className="error-text">{s.error}</p>}
        <Foot onBack={onClose} busy={s.busy} label={cta} />
      </form>
    </Modal>
  );
}

// ---------- Support cases ----------
export function CreateCaseModal({ onClose, onCreated }: { onClose: () => void; onCreated: (c: CaseDetail) => void }) {
  const opts = useApi<{ categories: string[]; impact: string[]; urgency: string[] }>('/cases/options');
  const profile = useApi<AccountProfile>('/portal/profile').data;
  const [f, setF] = useState({ partnerReference: '', category: '', summary: '', detail: '', impact: '', urgency: '', serviceReference: '' });
  const s = useSubmit(() => api<CaseDetail>('/cases', { method: 'POST', body: f }), onCreated);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const select = (k: 'category' | 'impact' | 'urgency', list?: string[]) => (
    <select className="select" required value={f[k]} onChange={set(k)}>
      <option value="">Select option</option>
      {list?.map((o) => <option key={o}>{o}</option>)}
    </select>
  );
  const F = ({ label, children, full }: { label: string; children: ReactNode; full?: boolean }) => (
    <label className={`field ${full ? 'full' : ''}`}><span>{label}</span>{children}</label>
  );
  return (
    <Modal title="Create new support case" onClose={onClose}>
      <form onSubmit={s.submit} className="form-grid">
        {F({ label: 'Account name', children: <input className="input" readOnly value={profile?.partnerName ?? ''} /> })}
        {F({ label: 'Contact name', children: <input className="input" readOnly value={profile ? `${profile.firstName} ${profile.lastName}` : ''} /> })}
        {F({ label: 'Partner reference', children: <input className="input" placeholder="Text field" maxLength={50} value={f.partnerReference} onChange={set('partnerReference')} /> })}
        {F({ label: 'Case category', children: select('category', opts.data?.categories) })}
        {F({ label: 'Case summary', full: true, children: <input className="input" required placeholder="Text field" maxLength={160} value={f.summary} onChange={set('summary')} /> })}
        {F({ label: 'Case detail', full: true, children: <textarea className="textarea input" required placeholder="Text field" maxLength={4000} value={f.detail} onChange={set('detail')} /> })}
        {F({ label: 'Impact', children: select('impact', opts.data?.impact) })}
        {F({ label: 'Urgency', children: select('urgency', opts.data?.urgency) })}
        {F({ label: 'Service reference (SOXXXXXX)', full: true, children: <input className="input" required pattern="[Ss][Oo]\d{6,10}" title="SO followed by 6-10 digits" placeholder="SO00023456" value={f.serviceReference} onChange={set('serviceReference')} /> })}
        {s.error && <p className="error-text full">{s.error}</p>}
        <div className="full"><Foot onBack={onClose} busy={s.busy} label="Submit case" /></div>
      </form>
    </Modal>
  );
}
