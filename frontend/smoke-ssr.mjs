import { createServer } from 'vite';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

globalThis.window = { location: { pathname: '/', search: '', hash: '' }, addEventListener() {}, removeEventListener() {}, history: { state: { idx: 0 }, pushState() {}, replaceState() {} }, innerWidth: 1024 };
globalThis.document = { defaultView: globalThis.window, addEventListener() {}, removeEventListener() {}, createElement() { return {}; }, getElementById() { return null; }, querySelector() { return null; } };
globalThis.localStorage = { _s: null, getItem() { return this._s; }, setItem(k, v) { this._s = v; }, removeItem() { this._s = null; } };
Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'node' }, configurable: true });
Object.defineProperty(globalThis, 'matchMedia', { value: () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }), configurable: true });

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
const { AppRoutes } = await server.ssrLoadModule('/src/App.jsx');
const { ToastProvider } = await server.ssrLoadModule('/src/components/ui/Toast.jsx');
const { AuthProvider } = await server.ssrLoadModule('/src/context/AuthContext.jsx');

const SUPER_ADMIN = { name: 'Admin', email: 'admin@zippio.io', role: 'super-admin', token: 'demo' };
globalThis.localStorage._s = JSON.stringify(SUPER_ADMIN);

const routes = [
  '/', '/login', '/forgot-password',
  '/app', '/app/history', '/app/profile',
  '/app/team', '/app/compare', '/app/evaluate', '/app/reports',
  '/app/hr/employees', '/app/hr/departments', '/app/hr/kpis',
  '/app/hr/users', '/app/hr/audit', '/app/hr/settings',
];

let failed = 0;
for (const path of routes) {
  try {
    const html = renderToString(
      React.createElement(ToastProvider, null,
        React.createElement(AuthProvider, null,
          React.createElement(MemoryRouter, { initialEntries: [path] },
            React.createElement(AppRoutes, null))))
    );
    console.log(`OK  ${path}  (${html.length} chars)`);
  } catch (e) {
    failed++;
    console.log(`ERR ${path}`);
    console.log(e && e.stack ? e.stack.split('\n').slice(0, 6).join('\n') : String(e));
  }
}

await server.close();
console.log(failed === 0 ? '\nALL ROUTES RENDERED OK' : `\n${failed} ROUTE(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
