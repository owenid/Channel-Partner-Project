import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApi } from '../api/client';
import type { Dashboard, QuoteVolumePoint, VolumeRange, Widget } from '../api/types';
import { Card, Icon, fmtDate, fmtTimeDate } from '../components/ui';
import { OfferArt, RocketArt } from '../components/Art';

/** Renders a dashboard widget, or a short message if its upstream system failed. */
function W<T>({ w, children }: { w?: Widget<T>; children: (d: T) => JSX.Element }) {
  if (!w) return <div className="skeleton" style={{ height: 180 }} />;
  if (!w.ok) return <p className="widget-error">This information is temporarily unavailable. Please try again shortly.</p>;
  return children(w.data);
}

const ranges: [VolumeRange, string][] = [['last-month', 'Last month'], ['last-3-months', 'Last 3 months'], ['last-12-months', 'Last 12 months'], ['last-24-months', 'Last 24 months']];

// Yellow/grey segment shades for the product donut, matching the sample
const donutShades = ['#e9c32e', '#fbf93b', '#fbf55a', '#fcf47c', '#fdf6a3', '#fdf9c4', '#fbfbe9', '#b9b8b0', '#f6f6ef', '#a9a8a0', '#fafaf2', '#c6c5bd', '#b0afa7'];

export function Home() {
  const [range, setRange] = useState<VolumeRange>('last-month');
  const dash = useApi<Dashboard>('/dashboard');
  const history = useApi<QuoteVolumePoint[]>(range === 'last-month' ? null : `/quotes/history?range=${range}`);
  const d = dash.data;
  const historyWidget: Widget<QuoteVolumePoint[]> | undefined =
    range === 'last-month' ? d?.quoteHistory : history.data ? { ok: true, data: history.data } : history.error ? { ok: false, error: 'swift' } : undefined;

  return (
    <main className="page">
      <div className="grid-home-top">
        <Card title="Channel partner news" help>
          <div className="news scroll-y" tabIndex={0}>
            <W w={d?.news}>{(news) => (
              <>{news.map((n) => (
                <article className="news-item" key={n.id}>
                  {n.imageUrl ? <img className="art" src={n.imageUrl} alt="" style={{ objectFit: 'cover' }} /> : <RocketArt />}
                  <h3>{n.title}</h3>
                  <p>{n.summary}</p>
                  <a className="link-plus" href={n.url}>Discover more <strong>+</strong></a>
                </article>
              ))}</>
            )}</W>
          </div>
        </Card>

        <Card title="Recent quotes" help bodyClass="flush">
          <W w={d?.recentQuotes}>{(quotes) => (
            <>
              <div>{quotes.map((q) => (
                <div className="quote-row" key={q.id}>
                  <span>{q.postcode}</span>
                  <time dateTime={q.createdAt}>{fmtTimeDate(q.createdAt)}</time>
                  <Link className="icon-btn" to={`/quotes/${q.id}`} aria-label={`View quote ${q.reference}`}>{Icon.eye()}</Link>
                </div>
              ))}</div>
              <div style={{ padding: '24px 22px' }}><Link className="btn btn-teal" to="/quotes">View more quotes {Icon.chevronRight()}</Link></div>
            </>
          )}</W>
        </Card>

        <Card title="Account profile">
          <W w={d?.profile}>{(p) => (
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
          <W w={d?.contacts}>{(c) => (
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
            <W w={d?.offers}>{(offers) => (
              <>{offers.map((o, i) => (
                <div className="offer" key={o.id}>
                  {o.imageUrl ? <img className="offer-img" src={o.imageUrl} alt="" /> : <OfferArt i={i} />}
                  <div><strong>{o.title}</strong><small>Expires: {fmtDate(o.expiresAt)}</small></div>
                  <a className="btn btn-teal btn-sm" href={o.url}>View offer</a>
                </div>
              ))}</>
            )}</W>
          </div>
        </Card>

        <Card title="Product summary">
          <W w={d?.productSummary}>{(products) => {
            // The design splits each variant into several shaded segments; we do the same by count.
            const total = products.reduce((a, p) => a + p.count, 0) || 1;
            const segments = products.flatMap((p, pi) => {
              const n = Math.max(1, Math.round((p.count / total) * 13));
              return Array.from({ length: n }, (_, k) => ({ name: p.variant, value: p.count / n, key: `${pi}-${k}` }));
            });
            return (
              <div style={{ display: 'flex', gap: 40, alignItems: 'flex-start' }}>
                <ul className="legend">{products.map((p) => <li key={p.variant}><span className="dot" />{p.variant}</li>)}</ul>
                <div style={{ width: 240, height: 240 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={segments} dataKey="value" nameKey="name" innerRadius="48%" outerRadius="100%" startAngle={90} endAngle={-270} stroke="#fff" strokeWidth={1} isAnimationActive={false}>
                        {segments.map((s, i) => <Cell key={s.key} fill={donutShades[i % donutShades.length]} />)}
                      </Pie>
                      <Tooltip formatter={(_v, name) => [`${products.find((p) => p.variant === name)?.count ?? ''} quotes`, name]} />
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
          <W w={historyWidget}>{(points) => (
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
    </main>
  );
}
