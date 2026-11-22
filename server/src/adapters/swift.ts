import { config } from '../config.js';
import { upstreamJson } from '../lib/httpClient.js';
import { cached } from '../lib/cache.js';
import { mockProducts, mockVolume } from '../mocks/data.js';
import type { ProductShare, QuoteVolumePoint, VolumeRange } from '../types.js';
import type { PortalUser } from '../auth.js';

/**
 * SWIFT adapter: Home "Quotes" volume chart and "Product summary" (both TBD in the Home Page
 * Menu design). Quote listing/creation lives in adapters/gig.ts.
 *
 * ASSUMED SWIFT contract - adjust once the SWIFT API spec is known:
 *   GET /accounts/{accountId}/quotes/history?from=&to=&interval=     -> { buckets: [{ period, count }] }
 *   GET /accounts/{accountId}/quotes/products?from=&to=              -> { products: [{ name, count }] }
 */
const up = config.swift;

const monthsFor: Record<VolumeRange, number> = { 'last-month': 1, 'last-3-months': 3, 'last-12-months': 12, 'last-24-months': 24 };
const rangeDates = (range: VolumeRange) => {
  const to = new Date();
  const from = new Date(to); from.setMonth(from.getMonth() - monthsFor[range]);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
};
const acct = (u: PortalUser) => encodeURIComponent(u.servicenowAccountId);

export async function getQuoteHistory(user: PortalUser, range: VolumeRange): Promise<QuoteVolumePoint[]> {
  if (up.useMock) return mockVolume(range);
  return cached(`swift:history:${user.servicenowAccountId}:${range}`, async () => {
    const res = await upstreamJson<{ buckets: { period: string; count: number }[] }>(
      up, `/accounts/${acct(user)}/quotes/history`, { query: { ...rangeDates(range), interval: range === 'last-month' ? 'day' : 'month' } },
    );
    return res.buckets.map((b) => ({
      period: b.period,
      label: new Date(b.period).toLocaleString('en-GB', b.period.length > 7 ? { day: '2-digit', month: 'short' } : { month: 'short', year: 'numeric' }),
      count: b.count,
    }));
  });
}

export async function getProductSummary(user: PortalUser): Promise<ProductShare[]> {
  if (up.useMock) return mockProducts;
  return cached(`swift:products:${user.servicenowAccountId}`, async () => {
    const res = await upstreamJson<{ products: { name: string; count: number }[] }>(
      up, `/accounts/${acct(user)}/quotes/products`, { query: rangeDates('last-12-months') },
    );
    return res.products.map((p) => ({ variant: p.name, count: p.count }));
  });
}
