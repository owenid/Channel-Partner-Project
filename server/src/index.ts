import 'dotenv/config'; // must load before config is read
import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { requireAuth } from './auth.js';
import { api, upstreamModes } from './routes.js';

const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: '100kb' }));

app.get('/health', (_req, res) => res.json({ ok: true, upstreams: upstreamModes() }));
app.use('/api', requireAuth, api);

app.listen(config.port, () => {
  console.log(`Portal back end on http://localhost:${config.port}`);
  console.log('Upstreams:', upstreamModes());
});
