import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import express from 'express';
import { chromium } from 'playwright';
import { proveExchangeBatchBrowser } from './exchange-batch-browser-journey.mjs';

// Explicit API fixture: proves built-frontend behavior, never native backend or production.
const output = path.resolve(process.env.EXCHANGE_BATCH_OUTPUT || 'test-results/exchange-batch-browser');
await fs.mkdir(output, { recursive: true });
const report = { head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), scope: 'Actual production-built frontend and native file inputs; explicit local authentication/listing/upload API fixtures. Not application SQL, native PostgreSQL, production object storage or live acceptance.', passed: false, nativeDatabaseProved: false, productionProved: false, devices: [] };
const app = express();
const users = new Map(), listings = [], objects = new Map();
const categories = [{ id: 'f1edc60a-579b-413e-b52a-4f65c3c74e62', name: 'Tools & Hardware' }, { id: '5c561458-fa5b-48a9-8fd6-b2186c0b5393', name: 'Furniture & Home Goods' }];
const current = req => users.get(String(req.headers.cookie || '').match(/batch_fixture=([^;]+)/)?.[1]);
app.use(express.json());
app.get('/api/auth/user', (req, res) => { const user = current(req); res.status(user ? 200 : 401).json(user || { message: 'Sign in' }); });
app.get('/api/marketplace/categories', (_req, res) => res.json(categories));
app.get('/api/marketplace/my-listings', (req, res) => { const user = current(req); res.status(user ? 200 : 401).json(user ? listings.filter(row => row.sellerId === user.id) : { message: 'Sign in' }); });
app.post('/api/objects/upload', (req, res) => current(req) ? res.json({ uploadURL: `/api/objects/upload/${randomUUID()}` }) : res.status(401).json({ message: 'Sign in' }));
app.put('/api/objects/upload/:id', express.raw({ type: () => true, limit: '10mb' }), (req, res) => { if (!current(req)) return res.status(401).end(); objects.set(req.params.id, req.body); res.type('text').send(`/uploads/${req.params.id}`); });
app.get('/uploads/:id', (req, res) => { const bytes = objects.get(req.params.id); if (!bytes) return res.status(404).end(); res.type('jpeg').send(bytes); });
app.post('/api/marketplace/listings', (req, res) => {
  const user = current(req); if (!user) return res.status(401).json({ message: 'Sign in' });
  const key = req.body.specifications?.externalListingId;
  if (listings.some(row => row.sellerId === user.id && row.specifications.externalListingId === key)) return res.status(409).json({ message: 'Existing key' });
  const listing = { ...req.body, id: randomUUID(), sellerId: user.id, status: 'pending_approval', approvedBy: null, approvedAt: null };
  listings.push(listing); res.status(201).json(listing);
});
app.get('/api/states', (_req, res) => res.json([{ code: 'FL', name: 'Florida' }]));
app.get('/api/counties', (_req, res) => res.json([{ fips: '12033', name: 'Escambia', stateCode: 'FL' }]));
app.use('/api', (req, res) => {
  if (req.path.includes('verification')) return res.json({ status: 'approved', verified: true });
  if (req.path.includes('preferences')) return res.json({});
  if (req.path.includes('counts')) return res.json({ unread: 0 });
  return res.json([]);
});
app.use(express.static(path.resolve('dist/public')));
app.get('*', (_req, res) => res.sendFile(path.resolve('dist/public/index.html')));
const server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  for (const device of ['desktop', 'touch']) report.devices.push(await proveExchangeBatchBrowser({ browser, base, device, output,
    authenticate: async (context, name) => {
      const id = 'batch-' + name;
      const user = { id, email: `${id}@example.test`, firstName: 'Batch', lastName: 'Seller', role: 'homeowner', roles: ['homeowner'], activeRole: 'homeowner', emailVerified: true, addressVerified: true, onboardingCompleted: true, profileVersion: 1, locationCommitted: true, stateCode: 'FL', countyFips: '12033', state: 'FL', county: 'Escambia', verificationStatus: 'approved' };
      users.set(id, user); await context.addCookies([{ name: 'batch_fixture', value: id, url: base }]); return user;
    }, readListings: async userId => listings.filter(row => row.sellerId === userId),
  }));
  report.passed = true;
} catch (error) { report.error = String(error.stack || error); process.exitCode = 1; }
finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); report.finishedAt = new Date().toISOString(); await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2)); }
