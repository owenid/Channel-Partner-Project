import type { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { config } from './config.js';

/**
 * Optional HTTP Basic auth in front of the whole demo (web app and API), switched on by
 * setting DEMO_PASSWORD (and optionally DEMO_USER, default "demo").
 *
 * Without Auth0 the back end signs everyone in as the built-in dev user, so a public demo
 * must not be left open. When Auth0 is configured this gate is off: Auth0 does the sign-in,
 * and Basic auth would collide with the Auth0 bearer token in the Authorization header.
 */
const user = process.env.DEMO_USER || 'demo';
const password = config.auth0.enabled ? '' : (process.env.DEMO_PASSWORD || '');
if (config.auth0.enabled && process.env.DEMO_PASSWORD) {
  console.log('Auth0 is configured, so DEMO_PASSWORD is ignored');
}

const same = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export function demoGate(req: Request, res: Response, next: NextFunction) {
  if (!password) return next();
  const [scheme, value] = (req.headers.authorization ?? '').split(' ');
  if (scheme === 'Basic' && value) {
    const decoded = Buffer.from(value, 'base64').toString('utf8');
    const i = decoded.indexOf(':');
    if (i > 0 && same(decoded.slice(0, i), user) && same(decoded.slice(i + 1), password)) return next();
  }
  res.setHeader('WWW-Authenticate', 'Basic realm="Channel Partner Portal demo", charset="UTF-8"');
  res.status(401).send('Sign in to view the Channel Partner Portal demo.');
}
