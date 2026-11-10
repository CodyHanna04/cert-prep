/**
 * The Content Security Policy for every page. Scripts run only with this request's nonce ('strict-dynamic' lets
 * those scripts load Next.js's own chunks), so an injected <script> or inline handler does not run. Everything else
 * is same-origin only. Styles allow inline style attributes, which the charts and meters use for sizes.
 * Development adds what the dev server needs: eval for React's debugging tools and a websocket for hot reload.
 * @param {string} nonce
 * @param {{ dev?: boolean }} [opts]
 */
export function buildCsp(nonce, { dev = false } = {}) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${dev ? " ws: wss:" : ""}`,
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/** A fresh nonce: 128 random bits, base64. */
export function makeNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}
