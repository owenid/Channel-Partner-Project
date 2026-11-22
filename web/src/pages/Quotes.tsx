import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, download, qs, useApi } from '../api/client';
import type { CreatedQuote, GigAddress, HistoryQuote, Me, QuotesResponse } from '../api/types';
import { Badge, Icon, Pagination, Sort, Th, fmtDateTime } from '../components/ui';

const PAGE_SIZE = 8;

// ---------------------------------------------------------------------------
// My Quotes (Retrieve Quotes design): GET /partner/quotes?summary=false
// Partner users see their own quotes; partner admins see the whole partner's.
// ---------------------------------------------------------------------------
export function MyQuotes() {
  const me = useApi<Me>('/me');
  const empty = { id: '', customer_name: '', postcode: '', address: '', ip_address: '', after: '', before: '' };
  const [f, setF] = useState(empty);
  const [applied, setApplied] = useState(empty);
  const [hidden, setHidden] = useState(false);
  const [sort, setSort] = useState<Sort>({ key: 'date', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const params = {
    ...applied,
    after: applied.after ? `${applied.after}T00:00:00Z` : undefined, before: applied.before ? `${applied.before}T23:59:59Z` : undefined,
    include_hidden: hidden || undefined, sort: sort ? 'date' : undefined, order: sort?.dir ?? 'desc', summary: 'false',
  };
  const list = useApi<QuotesResponse<HistoryQuote>>(`/partner/quotes${qs({ ...params, page, limit: PAGE_SIZE })}`);
  useEffect(() => setPage(1), [applied, hidden, sort]);

  const search = (e: FormEvent) => { e.preventDefault(); setApplied(f); };
  const toggleHide = async (q: HistoryQuote) => {
    setBusy(q.quote_id);
    try { await api(`/partner/quotes/${q.quote_id}/hide`, { method: 'POST', body: { hide: !q.hide_quote } }); list.reload(); } finally { setBusy(null); }
  };
  const set = (k: keyof typeof empty) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const field = (k: keyof typeof empty, label: string, type = 'text') => (
    <label className="field"><span>{label}</span><input className="input" type={type} placeholder={type === 'text' ? 'Text here...' : undefined} value={f[k]} onChange={set(k)} /></label>
  );

  return (
    <main className="page split">
      <section className="card">
        <header className="card-head"><h2>Search quotes</h2></header>
        <form className="card-body" style={{ padding: '30px 30px 34px' }} onSubmit={search}>
          {field('id', 'Search quote ID')}
          {field('customer_name', 'Search company name')}
          {field('postcode', 'Search postcode')}
          {field('address', 'Search address')}
          {field('ip_address', 'Search IP')}
          <div className="field"><span className="label">Created between</span>
            <div className="date-range">
              <input className="input" type="date" aria-label="From" value={f.after} max={f.before || undefined} onChange={set('after')} />
              <span>-</span>
              <input className="input" type="date" aria-label="To" value={f.before} min={f.after || undefined} onChange={set('before')} />
            </div>
          </div>
          <label className="check" style={{ marginBottom: 22 }}><input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} /> Show hidden quotes</label>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-teal">Search {Icon.search()}</button>
            <button type="button" className="btn btn-ghost" onClick={() => { setF(empty); setApplied(empty); }}>Clear {Icon.filter()}</button>
          </div>
        </form>
      </section>

      <section className="card">
        <header className="card-head">
          <h2>{me.data?.role === 'partner-admin' ? 'Partner quotes' : 'My quotes'}</h2>
        </header>
        <div className="card-body" style={{ padding: '34px 34px 30px' }}>
          <div className="toolbar">
            <button className="btn btn-teal" onClick={() => download(`/partner/quotes.csv${qs(params)}`)}>Export list {Icon.download()}</button>
            <button className="btn btn-outline" onClick={list.reload}>Refresh data {Icon.refresh()}</button>
            <div className="end"><Link className="btn btn-teal" to="/quotes/new">New quote {Icon.chevronRight()}</Link></div>
          </div>
          {me.data?.role === 'partner-admin' && <p className="muted" style={{ marginTop: -14, fontSize: 12 }}>You&apos;re a partner admin, so you can see quotes created by everyone in your organisation.</p>}
          <div className="table-wrap"><table>
            <thead><tr>
              <Th label="ID" /><Th label="Search type" /><Th label="Customer name" /><Th label="Address" /><Th label="Post code" />
              <Th label="Created at" sortKey="date" sort={sort} onSort={setSort} /><Th label="Created by" /><Th label="Hide quote" />
            </tr></thead>
            <tbody style={{ opacity: list.loading ? 0.55 : 1 }}>
              {list.error && <tr><td colSpan={8} className="empty">Couldn&apos;t load quotes. Try Refresh data.</td></tr>}
              {!list.data && !list.error && <tr><td colSpan={8}><div className="skeleton" style={{ height: 200 }} /></td></tr>}
              {list.data?.quotes.length === 0 && <tr><td colSpan={8} className="empty">No quotes match these filters.</td></tr>}
              {list.data?.quotes.map((q) => (
                <tr key={q.quote_id} style={q.hide_quote ? { opacity: 0.55 } : undefined}>
                  <td><Link to={`/quotes/${q.quote_id}`} style={{ fontWeight: 700 }}>{q.quote_id.slice(0, 10).toUpperCase()}</Link></td>
                  <td>{q.search_type ?? 'Single Search'}</td>
                  <td>{q.customer_name}</td>
                  <td>{q.short_address}{q.city ? `, ${q.city}` : ''}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{q.post_code}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(q.created_at)}</td>
                  <td>{q.created_by}</td>
                  <td>
                    <button className={`btn btn-sm ${q.hide_quote ? 'btn-outline' : 'btn-red'}`} style={{ height: 26, padding: '0 14px' }} disabled={busy === q.quote_id} onClick={() => toggleHide(q)}>
                      {q.hide_quote ? 'Unhide' : 'Hide'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
          {list.data && <Pagination page={page} pageSize={PAGE_SIZE} total={list.data.total} onPage={setPage} />}
        </div>
      </section>
    </main>
  );
}

// ---------------------------------------------------------------------------
// New quote (Check FTTP Availability design): postcode -> addresses -> generate quote
// ---------------------------------------------------------------------------
const POSTCODE = /^[A-Z0-9]{2,4} ?[A-Z0-9]{3}$/i;
const availabilityBadge = (s: string) => (s === 'Available' ? 'Available' : s === 'Planned' ? 'Pre-Order' : 'Not available');

export function NewQuote() {
  const navigate = useNavigate();
  const [postcode, setPostcode] = useState('');
  const [addresses, setAddresses] = useState<GigAddress[] | null>(null);
  const [selected, setSelected] = useState<GigAddress | null>(null);
  const [customer, setCustomer] = useState('');
  const [types, setTypes] = useState<string[]>(['fttp']);
  const [promo, setPromo] = useState('');
  const [loading, setLoading] = useState<'addr' | 'quote' | null>(null);
  const [error, setError] = useState<string>();

  const getAddresses = async (e: FormEvent) => {
    e.preventDefault();
    if (!POSTCODE.test(postcode.trim())) return setError('Enter a valid postcode, for example PO4 4DT.');
    setError(undefined); setLoading('addr'); setSelected(null);
    try {
      const r = await api<{ addresses: GigAddress[] }>(`/postcodes/${encodeURIComponent(postcode.trim())}`, { method: 'POST' });
      setAddresses(r.addresses);
      if (!r.addresses.length) setError('No addresses were found for this postcode.');
    } catch (err) { setError((err as Error).message); } finally { setLoading(null); }
  };

  const generate = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setError(undefined); setLoading('quote');
    try {
      const q = await api<CreatedQuote>('/partner/quotes', {
        method: 'POST',
        body: {
          address_key: selected.address.uprn, postcode: selected.address.postCode,
          customer_name: customer.trim() || undefined, product_types: types, promocode: promo.trim() || undefined,
        },
      });
      navigate(`/quotes/${q.quote_uid}`);
    } catch (err) { setError((err as Error).message); setLoading(null); }
  };

  return (
    <main className="page">
      <section className="card">
        <header className="card-head"><h2>New quote</h2></header>
        <div className="tabs" role="tablist"><button className="active" role="tab" aria-selected>Single address</button></div>
        <div className="card-body" style={{ padding: 30 }}>
          <form onSubmit={getAddresses} style={{ maxWidth: 560 }}>
            <h3 className="step-title"><b>1</b> Find the address</h3>
            <label className="field"><span>Postcode</span>
              <div style={{ display: 'flex', gap: 12 }}>
                <input className="input" value={postcode} onChange={(e) => setPostcode(e.target.value.toUpperCase())} placeholder="e.g. PO4 4DT" autoFocus maxLength={8} />
                <button className="btn btn-teal" disabled={loading === 'addr'} style={{ height: 46 }}>{loading === 'addr' ? 'Searching…' : 'Get addresses'} {Icon.search()}</button>
              </div>
            </label>
          </form>

          {addresses && addresses.length > 0 && (
            <form onSubmit={generate}>
              <h3 className="step-title" style={{ marginTop: 26 }}><b>2</b> Select the address</h3>
              <div className="addr-list" role="radiogroup" aria-label="Addresses">
                {addresses.map((a) => (
                  <label key={a.address.uprn} className={`addr ${selected === a ? 'on' : ''}`}>
                    <input type="radio" name="addr" aria-label={`${a.address.formatted_short}, ${a.address.postCode}`} checked={selected === a} onChange={() => setSelected(a)} />
                    <span>{a.address.formatted_short}, {a.address.postTown} {a.address.postCode}</span>
                    <small>UPRN {a.address.uprn}</small>
                    <span><Badge status={availabilityBadge(a.fttpAvailabilityStatus)} /></span>
                  </label>
                ))}
              </div>

              <h3 className="step-title" style={{ marginTop: 26 }}><b>3</b> Quote details</h3>
              <div className="form-grid" style={{ maxWidth: 900 }}>
                <label className="field"><span>Company / customer name</span><input className="input" value={customer} maxLength={120} onChange={(e) => setCustomer(e.target.value)} placeholder="e.g. Discovery Schools" /></label>
                <label className="field"><span>Promo code (optional)</span><input className="input" value={promo} maxLength={30} onChange={(e) => setPromo(e.target.value.toUpperCase())} placeholder="e.g. GIGA-23" /></label>
                <fieldset className="field full" style={{ border: 0, padding: 0, margin: 0 }}>
                  <legend className="label">Product types</legend>
                  <div style={{ display: 'flex', gap: 28 }}>
                    {[['fttp', 'FTTP'], ['ethernet', 'Ethernet']].map(([v, l]) => (
                      <label className="check" key={v}><input type="checkbox" checked={types.includes(v)} onChange={(e) => setTypes(e.target.checked ? [...types, v] : types.filter((t) => t !== v))} /> {l}</label>
                    ))}
                  </div>
                </fieldset>
              </div>
              {error && <p className="error-text">{error}</p>}
              <button className="btn btn-teal" disabled={!selected || !types.length || loading === 'quote'}>{loading === 'quote' ? 'Generating…' : 'Generate quote'} {Icon.chevronRight()}</button>
            </form>
          )}
          {(!addresses || !addresses.length) && error && <p className="error-text">{error}</p>}
        </div>
      </section>
    </main>
  );
}
