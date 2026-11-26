import type { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'node:crypto';

/**
 * Optional HTTP Basic auth in front of the whole demo (web app and API), switched on by
 * setting DEMO_PASSWORD (and optionally DEMO_USER, default "demo").
 *
 * Without Auth0 the back end signs everyone in as the built-in dev user, so a public demo
 * must not be left open. This is a demo gate only - real partners sign in with Auth0.
 */
const user = process.env.DEMO_USER || 'demo';
const password = process.env.DEMO_PASSWORD || '';

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
