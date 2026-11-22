// Mock data in the exact shapes from the "Home Page Menu" design (Confluence).
import type { Newsletter, PortalOffer } from '../types.js';

const body =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim.';

export const mockNewsletters: Newsletter[] = ['April', 'May', 'June', 'July'].map((month, i) => ({
  id: 4 + i,
  newsletter_title: `${month} Newsletter 2023`,
  newsletter_body: body,
  start_date: `2023-${String(4 + i).padStart(2, '0')}-01T00:00:00`,
  end_date: `2023-${String(4 + i).padStart(2, '0')}-28T23:59:59`,
  img_src: null, // the front end shows its placeholder illustration when there's no image
}));

export const mockPortalOffers: PortalOffer[] = [
  ['1234', 'Channel partner discount', '10% off SoGEA installs for new sites ordered this quarter.'],
  ['1235', 'Channel partner discount', 'Free upgrade to 900 Mbps for the first 3 months on FTTP orders.'],
  ['1236', 'Channel partner discount', 'Waived connection charge on 36-month leased line contracts.'],
  ['1237', 'Channel partner discount', 'Double partner incentive on SD-WAN bundles.'],
].map(([id, title, description], i) => ({
  id, name: `Test Offer ${i + 1}`, title, description,
  start_date: '2023-01-01T00:00:00', end_date: '2023-10-10T23:59:59', image_src: null,
}));
