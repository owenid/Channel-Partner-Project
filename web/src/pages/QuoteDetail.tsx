import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, useApi } from '../api/client';
import { isOrderable, needsEngineer, type AppointmentSlot, type PlaceOrderResponse, type QuoteDetail, type QuoteProduct } from '../api/types';
import { Badge, Icon, Modal, RO, fmtDateTime } from '../components/ui';
import { SlotPicker, slotLabel } from '../components/SlotPicker';

const mbps = (v: string) => (Number(v) >= 1000 ? `${Number(v) / 1000} Gbps` : `${v} Mbps`);

/**
 * Quote detail (Retrieve Quotes / Check FTTP Availability designs):
 * GET /partner/quotes/{quote_ulid}, polled while GIG is still collecting supplier responses.
 */
export function QuoteDetailPage() {
  const { id } = useParams();
  const q = useApi<QuoteDetail>(`/partner/quotes/${id}`);
  const [type, setType] = useState<'all' | 'FTTP' | 'Ethernet'>('all');
  const [carrier, setCarrier] = useState('all');
  const [selected, setSelected] = useState<QuoteProduct | null>(null);
  const [step, setStep] = useState<'summary' | 'order' | null>(null);
  const [placed, setPlaced] = useState<PlaceOrderResponse | null>(null);

  const generating = !!q.data && q.data.remaining_providers > 0;
  useEffect(() => {
    if (!generating) return;
    const t = setTimeout(q.reload, 1500);
    return () => clearTimeout(t);
  }, [generating, q.data, q.reload]);

  const carriers = useMemo(() => [...new Set(q.data?.quotes.map((p) => p.carrier))], [q.data]);
  const products = (q.data?.quotes ?? [])
    .filter((p) => (type === 'all' || p.product_type === type) && (carrier === 'all' || p.carrier === carrier))
    .sort((a, b) => Number(isOrderable(b)) - Number(isOrderable(a)) || Number(b.cdr_speed_download) - Number(a.cdr_speed_download));

  if (q.error) return <main className="page"><section className="card"><header className="card-head"><h2>Quote not found</h2></header><div className="card-body"><p>{q.error.message}. <Link to="/quotes">Back to quotes</Link></p></div></section></main>;
  if (!q.data) return <main className="page"><div className="skeleton" style={{ height: 400 }} /></main>;
  const d = q.data;
  const done = d.total_providers - d.remaining_providers;

  return (
    <main className="page">
      <section className="card">
        <header className="card-head"><h2>Quote {d.quote_ulid.slice(0, 10).toUpperCase()}{d.customer_name ? ` - ${d.customer_name}` : ''}</h2></header>
        <div className="card-body" style={{ padding: '22px 22px 28px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 24, marginBottom: 24 }}>
            <div className="panel"><h3>Location info</h3>
              <div className="ro-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <RO label="Address" value={d.address.short_address} /><RO label="Postcode" value={d.address.postcode} />
                <RO label="Town" value={d.address.town} /><RO label={d.address.identifier.type} value={d.address.identifier.reference} />
              </div>
            </div>
            <div className="panel"><h3>Quote details</h3>
              <div className="ro-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                <RO label="Quote ID" value={d.quote_ulid.toUpperCase()} />
                <RO label="Created" value={fmtDateTime(d.created_at)} />
                <RO label="Created by" value={d.created_by} />
                <RO label="Status" value={<Badge status={generating ? 'In progress' : 'Completed'} />} />
                <RO label="Promo code" value={d.promocode ?? 'None'} />
                <RO label="Promo code result" value={d.promocode ? d.promocode_message : '—'} />
              </div>
            </div>
          </div>

          <div className="panel" style={{ marginBottom: 24 }} aria-live="polite">
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 10 }}>
              <strong>{generating ? 'Checking suppliers for available products…' : 'All suppliers have responded'}</strong>
              <span className="muted">{done} of {d.total_providers} suppliers</span>
            </div>
            <div className="progress"><span style={{ width: `${(done / Math.max(1, d.total_providers)) * 100}%` }} /></div>
          </div>

          <div className="toolbar" style={{ marginBottom: 16 }}>
            <div className="chips" role="group" aria-label="Product type">
              {(['all', 'FTTP', 'Ethernet'] as const).map((t) => <button key={t} className={`chip ${type === t ? 'on' : ''}`} onClick={() => setType(t)}>{t === 'all' ? 'All products' : t}</button>)}
            </div>
            <select className="select" style={{ width: 220, height: 36 }} value={carrier} onChange={(e) => setCarrier(e.target.value)} aria-label="Supplier">
              <option value="all">All suppliers</option>
              {carriers.map((c) => <option key={c}>{c}</option>)}
            </select>
            <span className="end muted" style={{ fontSize: 12 }}>{products.length} products</span>
          </div>

          <div className="table-wrap"><table>
            <thead><tr>
              <th style={{ width: 40 }}><span className="visually-hidden">Select</span></th>
              <th>Product</th><th>Supplier</th><th>Type</th><th>Speed (down / up)</th><th>Guaranteed</th>
              <th>Availability</th><th>Install type</th><th>Engineer</th><th>Lead time</th><th>Router</th>
            </tr></thead>
            <tbody>
              {products.length === 0 && <tr><td colSpan={11} className="empty">{generating ? 'Waiting for suppliers…' : 'No products are available at this address.'}</td></tr>}
              {products.map((p) => {
                const can = isOrderable(p);
                const on = selected?.partner_product_code === p.partner_product_code;
                return (
                  <tr key={p.partner_product_code} className={`${can ? 'selectable' : ''} ${on ? 'selected' : ''}`} onClick={() => can && setSelected(p)} style={can ? undefined : { opacity: 0.6 }}>
                    <td><input type="radio" name="product" aria-label={`Select ${p.product_name}`} disabled={!can} checked={on} onChange={() => setSelected(p)} style={{ accentColor: 'var(--teal)' }} /></td>
                    <td><strong>{p.product_name}</strong><div className="muted" style={{ fontSize: 11 }}>{p.partner_product_code}{p.months_free_rental ? ` · ${p.months_free_rental} months free` : ''}</div></td>
                    <td>{p.carrier}</td>
                    <td>{p.product_type}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{mbps(p.cdr_speed_download)} / {mbps(p.cdr_speed_upload)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{mbps(p.guaranteed_download_speed)}</td>
                    <td><Badge status={p.availability_status} /></td>
                    <td>{p.install_type}</td>
                    <td>{needsEngineer(p) ? 'Required' : 'Not required'}</td>
                    <td>{p.lead_time ? `${p.lead_time} days` : '—'}</td>
                    <td>{p.router}</td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>

          <div className="sticky-foot">
            <span style={{ fontSize: 13 }}>{selected ? <>Selected: <strong>{selected.product_name}</strong> ({selected.carrier})</> : <span className="muted">Select an available product to continue</span>}</span>
            <button className="btn btn-teal" style={{ marginLeft: 'auto' }} disabled={!selected} onClick={() => setStep('summary')}>Proceed {Icon.chevronRight()}</button>
          </div>
        </div>
      </section>

      {step === 'summary' && selected && (
        <QuoteSummaryModal quote={d} product={selected} onClose={() => setStep(null)} onProceed={() => setStep('order')} />
      )}
      {step === 'order' && selected && (
        <PlaceOrderModal quote={d} product={selected} onBack={() => setStep('summary')} onClose={() => setStep(null)} onPlaced={(r) => { setStep(null); setPlaced(r); }} />
      )}
      {placed && (
        <Modal title="Order placed" onClose={() => setPlaced(null)} width={620}>
          <p style={{ marginTop: 0 }}>Your order was accepted and has been created. You can track it under Connections.</p>
          <dl className="dl" style={{ gridTemplateColumns: '200px 1fr' }}>
            <dt>Giganet order reference:</dt><dd>{placed.giganet_order_reference}</dd>
            <dt>Service order reference:</dt><dd>{placed.order_reference}</dd>
            {placed.partner_reference && <><dt>Your reference:</dt><dd>{placed.partner_reference}</dd></>}
          </dl>
          <div className="modal-foot">
            <button className="btn btn-ghost" onClick={() => setPlaced(null)}>Close</button>
            <Link className="btn btn-teal" to="/connections?tab=orders">View orders {Icon.chevronRight()}</Link>
          </div>
        </Modal>
      )}
    </main>
  );
}

/** Order Placement design: "Proceed" displays the quote summary for review. */
function QuoteSummaryModal({ quote, product, onClose, onProceed }: { quote: QuoteDetail; product: QuoteProduct; onClose: () => void; onProceed: () => void }) {
  return (
    <Modal title="Quote summary" onClose={onClose}>
      <h3 style={{ font: '700 14px var(--body)', marginBottom: 16 }}>Order information</h3>
      <dl className="dl" style={{ gridTemplateColumns: '170px 1fr', rowGap: 8 }}>
        <dt>Product:</dt><dd>{product.product_name} ({product.partner_product_code})</dd>
        <dt>Supplier:</dt><dd>{product.carrier} {product.carrier === 'Giganet' ? '(on-net)' : '(off-net)'}</dd>
        <dt>Speed:</dt><dd>{mbps(product.cdr_speed_download)} down / {mbps(product.cdr_speed_upload)} up (guaranteed {mbps(product.guaranteed_download_speed)})</dd>
        <dt>Install type:</dt><dd>{product.install_type}</dd>
        <dt>Engineer appointment:</dt><dd>{needsEngineer(product) ? 'Required' : 'Not required'}</dd>
        <dt>Router:</dt><dd>{product.router}</dd>
        <dt>Address:</dt><dd>{quote.address.short_address}, {quote.address.town}, {quote.address.postcode}</dd>
        {quote.customer_name && <><dt>Customer:</dt><dd>{quote.customer_name}</dd></>}
        {product.months_free_rental > 0 && <><dt>Promotion:</dt><dd>{product.months_free_rental} months free rental ({quote.promocode})</dd></>}
      </dl>
      <div className="modal-foot">
        <button className="btn btn-ghost" onClick={onClose}>{Icon.chevronLeft()} Back</button>
        <button className="btn btn-teal" onClick={onProceed}>Proceed {Icon.chevronRight()}</button>
      </div>
    </Modal>
  );
}

/**
 * Order Placement design: query appointments, capture order details, then "Place order now"
 * (the back end reserves the slot and places the order with the reservation key).
 */
function PlaceOrderModal({ quote, product, onBack, onClose, onPlaced }: {
  quote: QuoteDetail; product: QuoteProduct; onBack: () => void; onClose: () => void; onPlaced: (r: PlaceOrderResponse) => void;
}) {
  const onNet = product.carrier === 'Giganet';
  const engineer = needsEngineer(product);
  const onts = product.meta?.onts ?? [];
  const [slot, setSlot] = useState<AppointmentSlot | null>(null);
  const [installMode, setInstallMode] = useState<'slot' | 'asap' | 'date'>(engineer ? 'slot' : 'asap');
  const [requested, setRequested] = useState('');
  const [f, setF] = useState({
    partner_reference: '', customer_site_name: quote.customer_name ?? '', firstName: '', lastName: '', email: '',
    phoneType: 'mobile_phone', phone: '', notes: '', hazards: '', ont_ref: onts[0]?.ont_reference ?? '', ont_port: '',
  });
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const input = (k: keyof typeof f, label: string, props: Record<string, unknown> = {}) => (
    <label className="field"><span>{label}</span><input className="input" value={f[k]} onChange={set(k)} {...props} /></label>
  );
  const scheduleOk = installMode === 'slot' ? !!slot : installMode === 'date' ? !!requested : true;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(undefined);
    try {
      const r = await api<PlaceOrderResponse>(`/partner/fttp/orders`, {
        method: 'POST',
        body: {
          partner_reference: f.partner_reference || undefined, notes: f.notes || undefined,
          product_order_item: {
            quote_ulid: quote.quote_ulid, partner_product_code: product.partner_product_code,
            address_key: quote.address.addressKey ?? quote.address.identifier.reference, postcode: quote.address.postcode,
            customer_site_name: f.customer_site_name,
            end_customer_contact: { firstName: f.firstName, lastName: f.lastName, email: f.email, [f.phoneType]: f.phone },
            appointment_slot: installMode === 'slot' ? slot : undefined,
            requested_install_datetime: installMode === 'date' ? new Date(requested).toISOString() : undefined,
            install_asap: installMode === 'asap' || undefined,
            hazards: f.hazards || undefined, ont_ref: f.ont_ref || undefined, ont_port: f.ont_port || undefined,
          },
        },
      });
      onPlaced(r);
    } catch (err) { setError((err as Error).message); setBusy(false); }
  };

  return (
    <Modal title="Place order" onClose={onClose} width={980}>
      <form onSubmit={submit}>
        <h3 className="step-title"><b>1</b> End customer</h3>
        <div className="form-grid">
          {input('customer_site_name', 'Customer site name', { required: true, maxLength: 120 })}
          {input('partner_reference', 'Your order reference (optional)', { maxLength: 50, placeholder: 'e.g. XYZ-CO-123456' })}
          {input('firstName', 'Contact first name', { required: true, maxLength: 60 })}
          {input('lastName', 'Contact last name', { required: true, maxLength: 60 })}
          {input('email', 'Contact email', { required: true, type: 'email', maxLength: 120 })}
          <label className="field"><span>Contact phone</span>
            <div style={{ display: 'flex', gap: 10 }}>
              <select className="select" style={{ width: 150 }} value={f.phoneType} onChange={set('phoneType')} aria-label="Phone type">
                <option value="mobile_phone">Mobile</option><option value="home_phone">Landline</option>
              </select>
              <input className="input" required type="tel" pattern="[+\d][\d\s]{9,19}" title="A UK phone number" value={f.phone} onChange={set('phone')} />
            </div>
          </label>
        </div>

        <h3 className="step-title" style={{ marginTop: 10 }}><b>2</b> Installation</h3>
        <div className="chips" role="radiogroup" aria-label="Installation" style={{ marginBottom: 16 }}>
          {engineer && <button type="button" className={`chip ${installMode === 'slot' ? 'on' : ''}`} onClick={() => setInstallMode('slot')}>Choose an engineer appointment</button>}
          <button type="button" className={`chip ${installMode === 'asap' ? 'on' : ''}`} onClick={() => setInstallMode('asap')}>Install as soon as possible</button>
          <button type="button" className={`chip ${installMode === 'date' ? 'on' : ''}`} onClick={() => setInstallMode('date')}>Request an install date</button>
        </div>
        {installMode === 'slot' && (
          <>
            <SlotPicker addressKey={quote.address.addressKey ?? quote.address.identifier.reference} productCode={product.partner_product_code} postcode={quote.address.postcode} value={slot} onChange={setSlot} />
            {slot && <p style={{ fontSize: 13 }}>Selected slot: <strong>{slotLabel(slot)}</strong></p>}
            {onNet && <p className="muted" style={{ fontSize: 12 }}>On-net order: Giganet confirms the appointment in ServiceNow.</p>}
          </>
        )}
        {installMode === 'date' && (
          <label className="field" style={{ maxWidth: 370 }}><span>Requested install date</span>
            <input className="input" type="datetime-local" required value={requested} min={new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 16)} onChange={(e) => setRequested(e.target.value)} />
          </label>
        )}
        <div className="form-grid" style={{ marginTop: 12 }}>
          <label className="field"><span>Hazards (optional)</span><input className="input" value={f.hazards} onChange={set('hazards')} maxLength={1000} placeholder="e.g. dog on site, asbestos survey" /></label>
          <label className="field"><span>Notes (optional)</span><input className="input" value={f.notes} onChange={set('notes')} maxLength={1000} /></label>
          {onts.length > 0 && (
            <>
              <label className="field"><span>ONT reference</span>
                <select className="select" value={f.ont_ref} onChange={set('ont_ref')}>{onts.map((o) => <option key={o.ont_reference}>{o.ont_reference}</option>)}</select>
              </label>
              <label className="field"><span>ONT port</span>
                <select className="select" value={f.ont_port} onChange={set('ont_port')}>
                  <option value="">Select option</option>
                  {onts.find((o) => o.ont_reference === f.ont_ref)?.available_ports.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
            </>
          )}
        </div>

        <hr />
        <label className="check"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /> I confirm that the details are correct</label>
        {error && <p className="error-text" style={{ marginTop: 14 }}>{error}</p>}
        <div className="modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onBack}>{Icon.chevronLeft()} Back</button>
          <button className="btn btn-teal" disabled={busy || !confirmed || !scheduleOk}>{busy ? 'Placing order…' : 'Place order now'} {Icon.chevronRight()}</button>
        </div>
      </form>
    </Modal>
  );
}
