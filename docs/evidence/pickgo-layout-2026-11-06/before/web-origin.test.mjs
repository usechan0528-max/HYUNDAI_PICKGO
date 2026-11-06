import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePublicOrigin, requestOrigin } from './web-origin.mjs';

test('public origin is opt-in HTTPS with no path, credentials or token', () => {
  assert.equal(parsePublicOrigin(), null);
  assert.equal(parsePublicOrigin('https://pickup.example/'), 'https://pickup.example');
  for (const value of ['http://pickup.example', 'https://u:p@pickup.example', 'https://pickup.example/app', 'https://pickup.example/?x=1', 'https://pickup.example/#x', 'bad']) assert.throws(() => parsePublicOrigin(value));
});
test('loopback default rejects external hosts and spoofed forwarding headers', () => {
  assert.equal(requestOrigin({host:'127.0.0.1:4180'},4180,null),'http://127.0.0.1:4180');
  for (const headers of [{host:'evil.example'}, {host:'127.0.0.1:4180',origin:'https://evil.example'}, {host:'evil.example','x-forwarded-host':'127.0.0.1:4180'}]) assert.equal(requestOrigin(headers,4180,null),null);
});
test('proxy origin requires exact Host/Origin; navigation without Origin can open invite', () => {
  const origin=parsePublicOrigin('https://pickup.example');
  assert.equal(requestOrigin({host:'pickup.example'},4180,origin),origin);
  assert.equal(requestOrigin({host:'pickup.example',origin},4180,origin),origin);
  for (const headers of [{host:'127.0.0.1:4180'}, {host:'pickup.example',origin:'http://pickup.example'}, {host:'pickup.example',origin:'null'}, {host:'pickup.example',origin:'https://evil.example'}, {host:'evil.example','x-forwarded-host':'pickup.example'}]) assert.equal(requestOrigin(headers,4180,origin),null);
});
