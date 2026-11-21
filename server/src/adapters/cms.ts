import { config } from '../config.js';
import { upstreamJson } from '../lib/httpClient.js';
import { cached } from '../lib/cache.js';
import { mockNews, mockOffers, mockResources } from '../mocks/data.js';
import type { NewsItem, Offer, Page, Resource, ResourceCategory } from '../types.js';
import type { PortalUser } from '../auth.js';

/**
 * CMS adapter: channel partner newsletters, offers and resource guides.
 *
 * ASSUMED CMS contract - adjust paths and field mapping once the CMS API spec is known:
 *   GET /newsletters?orgId=&limit=           -> { items: [{ id, title, excerpt, heroImage, slug, publishedAt }] }
 *   GET /offers?orgId=                       -> { items: [{ id, title, validTo, thumbnail, slug }] }
 *   GET /resources?category=&page=&pageSize= -> { items: [{ id, title, summary, tag, bannerText, image, url, theme, art }], total }
 */
const up = config.cms;

interface CmsNews { id: string; title: string; excerpt: string; heroImage?: string; slug: string; publishedAt: string }
interface CmsOffer { id: string; title: string; validTo: string; thumbnail?: string; slug: string }
interface CmsResource {
  id: string; title: string; summary: string; tag?: string; bannerText?: string;
  image?: string; url: string; theme?: Resource['theme']; art?: Resource['art'];
}

export async function getNews(user: PortalUser, limit = 5): Promise<NewsItem[]> {
  if (up.useMock) return mockNews.slice(0, limit);
  return cached(`cms:news:${user.orgId}:${limit}`, async () => {
    const res = await upstreamJson<{ items: CmsNews[] }>(up, '/newsletters', { query: { orgId: user.orgId, limit } });
    return res.items.map((n) => ({
      id: n.id, title: n.title, summary: n.excerpt, imageUrl: n.heroImage ?? null, url: n.slug, publishedAt: n.publishedAt,
    }));
  });
}

export async function getOffers(user: PortalUser): Promise<Offer[]> {
  if (up.useMock) return mockOffers;
  return cached(`cms:offers:${user.orgId}`, async () => {
    const res = await upstreamJson<{ items: CmsOffer[] }>(up, '/offers', { query: { orgId: user.orgId } });
    return res.items.map((o) => ({ id: o.id, title: o.title, expiresAt: o.validTo, imageUrl: o.thumbnail ?? null, url: o.slug }));
  });
}

export async function getResources(category: ResourceCategory, page: number, pageSize: number): Promise<Page<Resource>> {
  if (up.useMock) return mockResources(category, page, pageSize);
  return cached(`cms:resources:${category}:${page}:${pageSize}`, async () => {
    const res = await upstreamJson<{ items: CmsResource[]; total: number }>(up, '/resources', { query: { category, page, pageSize } });
    const themes: Resource['theme'][] = ['light', 'teal', 'dark'];
    return {
      page, pageSize, total: res.total,
      items: res.items.map((r, i) => ({
        id: r.id, category, title: r.title, summary: r.summary,
        tag: r.tag ?? 'Guides', bannerText: r.bannerText ?? r.title,
        imageUrl: r.image ?? null, url: r.url,
        theme: r.theme ?? themes[i % 3], art: r.art ?? 'laptop',
      })),
    };
  });
}
