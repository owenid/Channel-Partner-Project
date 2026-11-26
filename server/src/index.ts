import 'dotenv/config'; // must load before config is read
import express from 'express';
import cors from 'cors';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { requireAuth } from './auth.js';
import { demoGate } from './demoGate.js';
import { api, upstreamModes } from './routes.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // behind the hosting platform's load balancer
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: '100kb' }));

// Health stays open so the host's health checks pass
app.get('/health', (_req, res) => res.json({ ok: true, upstreams: upstreamModes() }));

// Optional username/password for public demos (DEMO_USER / DEMO_PASSWORD)
app.use(demoGate);

// Versioned as in the design docs (e.g. /api/v1/portal/newsletter, /api/v1/partner/quotes)
app.use('/api/v1', requireAuth, api);

// In production the built front end (web/dist) is served from this same service
const webDist = join(dirname(fileURLToPath(import.meta.url)), '../../web/dist');
if (existsSync(webDist)) {
  app.use(express.static(webDist, { index: false, maxAge: '1h' }));
  // client-side routes (/quotes/..., /connections/...) all load index.html
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(join(webDist, 'index.html')));
  console.log('Serving web app from', webDist);
}

app.listen(config.port, () => {
  console.log(`Portal back end on port ${config.port}`);
  console.log('Upstreams:', upstreamModes());
});
