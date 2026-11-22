import { ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApi } from '../api/client';
import type {
  AccountProfile, Newsletter, PortalOffer, ProductShare, QuoteSummaryItem, QuoteVolumePoint, QuotesResponse,
  SupportContacts, VolumeRange,
} from '../api/types';
import { Card, Icon, Modal, fmtDate, fmtTimeDate } from '../components/ui';
import { OfferArt, RocketArt } from '../components/Art';

/** Each Home widget loads from its own endpoint (Home Page Menu design) and fails on its own. */
function W<T>({ q, children, height = 180 }: { q: { data?: T; error?: Error }; children: (d: T) => ReactNode; height?: number }) {
  if (q.error) return <p className="widget-error">This information is temporarily unavailable. Please try again shortly.</p>;
  if (q.data === undefined) return <div className="skeleton" style={{ height }} />;
  return <>{children(q.data)}</>;
}

const ranges: [VolumeRange, string][] = [['last-month', 'Last month'], ['last-3-months', 'Last 3 months'], ['last-12-months', 'Last 12 months'], ['last-24-months', 'Last 24 months']];
const donutShades = ['#e9c32e', '#fbf93b', '#fbf55a', '#fcf47c', '#fdf6a3', '#fdf9c4', '#fbfbe9', '#b9b8b0', '#f6f6ef', '#a9a8a0', '#fafaf2', '#c6c5bd', '#b0afa7'];

function NewsItem({ n }: { n: Newsletter }) {
  const [open, setOpen] = useState(false);
  return (
    <article className="news-item">
      {n.img_src ? <img className="art" src={n.img_src.src} alt={n.img_src.alt} style={{ objectFit: 'cover' }} /> : <RocketArt />}
      <h3>{n.newsletter_title}</h3>
      <p style={open ? undefined : { display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{n.newsletter_body}</p>
      <button className="link-plus" style={{ background: 'none', border: 0, padding: 0 }} onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? 'Show less' : 'Discover more'} <strong>{open ? '−' : '+'}</strong>
      </button>
    </article>
  );
}

export function Home() {
  const [range, setRange] = useState<VolumeRange>('last-month');
  const [offer, setOffer] = useState<PortalOffer | null>(null);
  const news = useApi<{ results: Newsletter[] }>('/portal/newsletter');
  const offers = useApi<{ offers: PortalOffer[] }>('/portal/offers');
  // Home Page Menu design: last ten most recent quotes (own quotes for partner users, all for partner admins)
  const quotes = useApi<QuotesResponse<QuoteSummaryItem>>('/partner/quotes?limit=10&sort=date&order=desc&summary=true');
  const profile = useApi<AccountProfile>('/portal/profile');
  const contacts = useApi<SupportContacts>('/portal/contacts');
  const products = useApi<ProductShare[]>('/portal/product-summary');
  const volume = useApi<QuoteVolumePoint[]>(`/portal/quote-volume?range=${range}`);

  return (
    <main className="page">
      <div className="grid-home-top">
        <Card title="Channel partner news" help>
          <div className="news scroll-y" tabIndex={0}>
            <W q={{ data: news.data?.results, error: news.error }}>{(items) => items.length
              ? items.map((n) => <NewsItem key={n.id} n={n} />)
              : <p className="widget-error">No newsletters yet.</p>}
            </W>
          </div>
        </Card>

        <Card title="Recent quotes" help bodyClass="flush">
          <W q={{ data: quotes.data?.quotes, error: quotes.error }}>{(qs) => (
            <>
              <div className="scroll-y" style={{ maxHeight: 330 }} tabIndex={0}>
                {qs.length === 0 && <p className="widget-error">No quotes yet. <Link to="/quotes/new">Create a quote</Link></p>}
                {qs.map((q) => (
                  <div className="quote-row" key={q.id}>
                    <span>{q.postcode}</span>
                    <time dateTime={q.created_at}>{fmtTimeDate(q.created_at)}</time>
                    <Link className="icon-btn" to={`/quotes/${q.id}`} aria-label={`View quote for ${q.postcode}`}>{Icon.eye()}</Link>
                  </div>
                ))}
              </div>
              <div style={{ padding: '24px 22px' }}><Link className="btn btn-teal" to="/quotes">View more quotes {Icon.chevronRight()}</Link></div>
            </>
          )}</W>
        </Card>

        <Card title="Account profile">
          <W q={profile}>{(p) => (
            <>
              <dl className="dl">
                <dt>First name:</dt><dd>{p.firstName}</dd>
                <dt>Last name:</dt><dd>{p.lastName}</dd>
                <dt>Email address:</dt><dd><a href={`mailto:${p.email}`}>{p.email}</a></dd>
                <dt>Partner name:</dt><dd>{p.partnerName}</dd>
                <dt>Role:</dt><dd>{p.role}</dd>
                <dt>Department:</dt><dd>{p.department}</dd>
              </dl>
              <a className="btn btn-teal" href="#account">View account {Icon.chevronRight()}</a>
            </>
          )}</W>
        </Card>

        <Card title="Channel support contacts" help>
          <W q={contacts}>{(c) => (
            <>
              {c.contacts.map((x) => (
                <div className="contact" key={x.role}>
                  <h4>{x.role}</h4>
                  <p>{x.name}</p>
                  <a href={`mailto:${x.email}`}>{x.email}</a>
                </div>
              ))}
              <a className="btn btn-teal" href={c.websiteUrl} target="_blank" rel="noreferrer">Visit Giganet website {Icon.chevronRight()}</a>
            </>
          )}</W>
        </Card>
      </div>

      <div className="grid-home-bottom">
        <Card title="Offers" help bodyClass="flush">
          <div className="scroll-y" style={{ maxHeight: 252 }} tabIndex={0}>
            <W q={{ data: offers.data?.offers, error: offers.error }}>{(list) => list.map((o, i) => (
              <div className="offer" key={o.id}>
                {o.image_src ? <img className="offer-img" src={o.image_src.src} alt={o.image_src.alt} /> : <OfferArt i={i} />}
                <div><strong>{o.title}</strong><small>Expires: {fmtDate(o.end_date)}</small></div>
                <button className="btn btn-teal btn-sm" onClick={() => setOffer(o)}>View offer</button>
              </div>
            ))}</W>
          </div>
        </Card>

        <Card title="Product summary">
          <W q={products}>{(ps) => {
            const total = ps.reduce((a, p) => a + p.count, 0) || 1;
            const segments = ps.flatMap((p, pi) => {
              const n = Math.max(1, Math.round((p.count / total) * 13));
              return Array.from({ length: n }, (_, k) => ({ name: p.variant, value: p.count / n, key: `${pi}-${k}` }));
            });
            return (
              <div style={{ display: 'flex', gap: 40, alignItems: 'flex-start' }}>
                <ul className="legend">{ps.map((p) => <li key={p.variant}><span className="dot" />{p.variant}</li>)}</ul>
                <div style={{ width: 240, height: 240 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={segments} dataKey="value" nameKey="name" innerRadius="48%" outerRadius="100%" startAngle={90} endAngle={-270} stroke="#fff" strokeWidth={1} isAnimationActive={false}>
                        {segments.map((s, i) => <Cell key={s.key} fill={donutShades[i % donutShades.length]} />)}
                      </Pie>
                      <Tooltip formatter={(_v, name) => [`${ps.find((p) => p.variant === name)?.count ?? ''} quotes`, name]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          }}</W>
        </Card>

        <Card
          title="Quotes"
          action={
            <select className="select-pill" value={range} onChange={(e) => setRange(e.target.value as VolumeRange)} aria-label="Quote period">
              {ranges.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          }
        >
          <W q={volume}>{(points) => (
            <>
              <div style={{ height: 210 }}>
                <ResponsiveContainer>
                  <BarChart data={points} margin={{ top: 8, right: 8, left: -28, bottom: 4 }} barCategoryGap="10%">
                    <CartesianGrid vertical={false} stroke="#e6e6ea" />
                    <XAxis dataKey="label" tick={{ fontSize: 7 }} tickLine={false} axisLine={{ stroke: '#2c2d3c' }} interval={0} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 7 }} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: 'rgba(0,0,0,.04)' }} />
                    <Bar dataKey="count" name="Quotes" fill="#ecc531" isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ul className="legend" style={{ marginTop: 8 }}><li><span className="dot" />Quotes</li></ul>
            </>
          )}</W>
        </Card>
      </div>

      {offer && (
        <Modal title={offer.title} onClose={() => setOffer(null)} width={640}>
          {offer.image_src && <img src={offer.image_src.src} alt={offer.image_src.alt} style={{ width: '100%', borderRadius: 8, marginBottom: 18 }} />}
          <p style={{ marginTop: 0 }}>{offer.description}</p>
          <dl className="dl" style={{ gridTemplateColumns: '110px 1fr' }}>
            <dt>Valid from:</dt><dd>{fmtDate(offer.start_date)}</dd>
            <dt>Expires:</dt><dd>{fmtDate(offer.end_date)}</dd>
          </dl>
          <div className="modal-foot">
            <button className="btn btn-ghost" onClick={() => setOffer(null)}>{Icon.chevronLeft()} Back</button>
            <Link className="btn btn-teal" to="/quotes/new">Create a quote {Icon.chevronRight()}</Link>
          </div>
        </Modal>
      )}
    </main>
  );
}
