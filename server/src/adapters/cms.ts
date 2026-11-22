import { config } from '../config.js';
import { upstreamJson } from '../lib/httpClient.js';
import { cached } from '../lib/cache.js';
import { mockResources } from '../mocks/data.js';
import { mockNewsletters, mockPortalOffers } from '../mocks/home.js';
import type { ImageRef, Newsletter, Page, PortalOffer, Resource, ResourceCategory } from '../types.js';

/**
 * CMS (Drupal) adapter - per the "Home Page Menu" design:
 *   GET /api/v1/portal/newsletter -> CMS GET {CMS_BASE_URL}/drupalwebsite/jsonapi/node/newsletters
 *   GET /api/v1/portal/offers     -> CMS GET {CMS_BASE_URL}/drupalwebsite/jsonapi/node/offers
 *
 * The design gives the portal response shape but not Drupal's. Drupal JSON:API normally
 * returns { data: [{ id, attributes: {...} }] }, with custom fields often prefixed `field_`.
 * The mapper below reads either the plain or `field_` names, and also accepts a CMS that
 * already returns the portal shape ({ results } / { offers }). Confirm the real field
 * names with the CMS team and simplify this once known.
 */
const up = config.cms;

type Attrs = Record<string, unknown>;
interface JsonApiDoc { data?: { id: string; attributes?: Attrs }[]; results?: Attrs[]; offers?: Attrs[] }

const pick = (a: Attrs, ...keys: string[]): unknown => {
  for (const k of keys) {
    for (const key of [k, `field_${k}`]) if (a[key] !== undefined && a[key] !== null) return a[key];
  }
  return undefined;
};
const text = (v: unknown): string => {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object') { // Drupal text fields: { value, processed, format }
    const o = v as { processed?: string; value?: string };
    return (o.processed ?? o.value ?? '').replace(/<[^>]+>/g, '').trim();
  }
  return '';
};
const image = (v: unknown): ImageRef | null => {
  if (!v || typeof v !== 'object') return null;
  const o = v as Partial<ImageRef> & { url?: string; meta?: { alt?: string; width?: number; height?: number } };
  const src = o.src ?? o.url;
  if (!src || !/^https?:\/\//.test(src)) return null; // only absolute http(s) images reach the browser
  return { src, alt: o.alt ?? o.meta?.alt ?? '', width: Number(o.width ?? o.meta?.width ?? 0), height: Number(o.height ?? o.meta?.height ?? 0) };
};
const rows = (doc: JsonApiDoc, key: 'results' | 'offers'): { id: string; a: Attrs }[] =>
  doc[key]?.map((a) => ({ id: String(a.id ?? ''), a })) ??
  doc.data?.map((d) => ({ id: String(d.attributes?.drupal_internal__nid ?? d.id), a: d.attributes ?? {} })) ?? [];

export async function getNewsletters(): Promise<Newsletter[]> {
  if (up.useMock) return mockNewsletters;
  return cached('cms:newsletters', async () => {
    const doc = await upstreamJson<JsonApiDoc>(up, up.newslettersPath, { query: { sort: '-created' } });
    return rows(doc, 'results').map(({ id, a }) => ({
      id: Number(id) || 0,
      newsletter_title: text(pick(a, 'newsletter_title', 'title')),
      newsletter_body: text(pick(a, 'newsletter_body', 'body')),
      // the design's example uses both start_date and newsletter_start_date
      start_date: String(pick(a, 'start_date', 'newsletter_start_date') ?? ''),
      end_date: String(pick(a, 'end_date', 'newsletter_end_date') ?? ''),
      img_src: image(pick(a, 'img_src', 'image_src', 'image')),
    }));
  });
}

export async function getOffers(): Promise<PortalOffer[]> {
  if (up.useMock) return mockPortalOffers;
  return cached('cms:offers', async () => {
    const doc = await upstreamJson<JsonApiDoc>(up, up.offersPath, { query: { sort: '-created' } });
    return rows(doc, 'offers').map(({ id, a }) => ({
      id,
      name: text(pick(a, 'name')),
      title: text(pick(a, 'title')),
      description: text(pick(a, 'description', 'body')),
      start_date: String(pick(a, 'start_date', 'offer_start_date') ?? ''),
      end_date: String(pick(a, 'end_date', 'offer_end_date') ?? ''),
      image_src: image(pick(a, 'image_src', 'img_src', 'image')),
    }));
  });
}

// ---- Resources (not in the Home Page Menu design; contract still assumed) ----
interface CmsResource {
  id: string; title: string; summary: string; tag?: string; bannerText?: string;
  image?: string; url: string; theme?: Resource['theme']; art?: Resource['art'];
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
