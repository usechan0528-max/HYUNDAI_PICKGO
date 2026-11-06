// The HTTP service stays on loopback. TLS terminates at an explicitly configured
// reverse proxy which must preserve Host; forwarded headers are never authority.
export function parsePublicOrigin(value) {
  if (value === undefined || value === '') return null;
  let url;
  try { url = new URL(value); } catch { throw new Error('PICKUP_PUBLIC_ORIGIN must be an HTTPS origin.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('PICKUP_PUBLIC_ORIGIN must be an HTTPS origin without credentials, path, query or fragment.');
  }
  return url.origin;
}

export function requestOrigin(headers, port, publicOrigin) {
  const origin = publicOrigin || `http://127.0.0.1:${port}`;
  if (headers.host !== new URL(origin).host || (headers.origin !== undefined && headers.origin !== origin)) return null;
  if (headers['sec-fetch-site'] === 'cross-site' && headers.origin !== undefined) return null;
  return origin;
}
