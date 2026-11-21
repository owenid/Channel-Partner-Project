import { useSearchParams } from 'react-router-dom';
import { qs, useApi } from '../api/client';
import type { Page, Resource, ResourceCategory } from '../api/types';
import { Pagination } from '../components/ui';
import { ResourcePhoto } from '../components/Art';

const tabs: [ResourceCategory, string][] = [['quick-guides', 'Quick guides'], ['legal', 'Legal'], ['training', 'Training']];
const PAGE_SIZE = 8;

function ResourceCard({ r }: { r: Resource }) {
  return (
    <article className={`res ${r.theme === 'light' ? '' : r.theme}`}>
      <div className="res-banner">
        {r.imageUrl ? <img className="photo" src={r.imageUrl} alt="" style={{ objectFit: 'cover', width: '60%', height: '100%' }} /> : <ResourcePhoto art={r.art} />}
        {/* teal panel with the curved edge from the design */}
        <svg className="wave" viewBox="0 0 100 54" preserveAspectRatio="none" aria-hidden>
          <path d="M0 0 H44 C56 0 46 18 54 30 C60 40 66 46 64 54 H0 Z" fill="#4bb7c4" />
        </svg>
        <span className="tag">{r.tag}</span>
        <span className="banner-text">{r.bannerText}</span>
      </div>
      <div className="res-body">
        <h3>{r.title}</h3>
        <p>{r.summary}</p>
        <a className="link-plus" href={r.url} target="_blank" rel="noreferrer">View guide <strong>+</strong></a>
      </div>
    </article>
  );
}

export function Resources() {
  const [params, setParams] = useSearchParams();
  const tab = (tabs.find(([k]) => k === params.get('tab'))?.[0] ?? 'quick-guides') as ResourceCategory;
  const page = Number(params.get('page') ?? 1) || 1;
  const res = useApi<Page<Resource>>(`/resources${qs({ category: tab, page, pageSize: PAGE_SIZE })}`);

  return (
    <main className="page">
      <section className="card">
        <header className="card-head"><h2>Resources</h2></header>
        <div className="tabs" role="tablist">
          {tabs.map(([k, label]) => (
            <button key={k} role="tab" aria-selected={k === tab} className={k === tab ? 'active' : ''} onClick={() => setParams({ tab: k })}>{label}</button>
          ))}
        </div>
        <div className="card-body" style={{ padding: 22 }}>
          {res.error && <p className="error-text">Resources are temporarily unavailable.</p>}
          <div className="res-grid">
            {res.data?.items.map((r) => <ResourceCard key={r.id} r={r} />)}
            {res.loading && !res.data && Array.from({ length: 5 }, (_, i) => <div key={i} className="skeleton" style={{ height: 264 }} />)}
          </div>
          {res.data && (
            <Pagination page={page} pageSize={PAGE_SIZE} total={res.data.total} onPage={(p) => setParams({ tab, page: String(p) })} />
          )}
        </div>
      </section>
    </main>
  );
}
