import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { handleRequest } from '../server/worker.mjs';

const source = await readFile(new URL('../reservation-service.js', import.meta.url), 'utf8');
const { submitReservation } = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
);
const env = {
  ALLOWED_ORIGIN: 'https://studiob.bar',
  RESEND_API_KEY: 'test-key-not-real',
  RESERVATION_TO: 'owner@example.invalid',
  MAIL_FROM: 'reservations@example.invalid',
  TURNSTILE_SECRET_KEY: 'test-secret-not-real',
};
const now = new Date('2026-10-20T10:00:00Z'); // 12:00 Berlin (summer time)
const booking = {
  guests: 2, date: '2026-10-21', time: '18:30', name: 'Example Guest',
  phone: '+49 30 1234567', email: 'guest@example.invalid', note: 'Window seat',
  website: '', language: 'de',
  requestId: '550e8400-e29b-41d4-a716-446655440000',
  turnstileToken: 'test-token-not-real',
};
const challenge = { success: true, hostname: 'studiob.bar', action: 'reservation' };

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}

function request(data = booking, headers = {}, method = 'POST') {
  return new Request('https://worker.example.invalid/reservations', {
    method,
    headers: { Origin: env.ALLOWED_ORIGIN, 'Content-Type': 'application/json', ...headers },
    ...(method === 'POST' ? { body: typeof data === 'string' ? data : JSON.stringify(data) } : {}),
  });
}

function provider(responses) {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    assert.ok(responses.length, 'Unexpected external request');
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return next;
  };
  return { calls, fetcher };
}

test('mail is addressed only to the owner; reply-to and idempotency are explicit', async () => {
  const service = provider([json(challenge), json({ id: 'mail-test-id' })]);
  const response = await handleRequest(request(), env, { now, fetcher: service.fetcher });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), env.ALLOWED_ORIGIN);
  assert.deepEqual(await response.json(), { success: true, requestId: booking.requestId });
  assert.equal(service.calls.length, 2);
  const verification = service.calls[0];
  assert.equal(verification.url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
  assert.equal(verification.options.body.get('secret'), env.TURNSTILE_SECRET_KEY);
  assert.equal(verification.options.body.get('response'), booking.turnstileToken);
  const delivery = service.calls[1];
  assert.equal(delivery.url, 'https://api.resend.com/emails');
  assert.equal(delivery.options.headers['Idempotency-Key'], `studio-b-reservation/${booking.requestId}`);
  assert.equal(delivery.options.redirect, 'error');
  const mail = JSON.parse(delivery.options.body);
  assert.deepEqual(mail.to, [env.RESERVATION_TO]);
  assert.equal(mail.from, env.MAIL_FROM);
  assert.equal(mail.reply_to, booking.email);
  assert.equal(mail.html, undefined);
  assert.match(mail.text, /noch keine bestätigte Reservierung/);
  assert.doesNotMatch(mail.text, /test-token|test-secret/);
});

test('same request and fresh challenge produce identical mail and idempotency key', async () => {
  const mailCalls = [];
  for (const turnstileToken of ['token-one', 'token-two']) {
    const service = provider([json(challenge), json({ id: 'same-mail-id' })]);
    const response = await handleRequest(request({ ...booking, turnstileToken }), env, {
      now, fetcher: service.fetcher,
    });
    assert.equal(response.status, 200);
    mailCalls.push(service.calls[1].options);
  }
  assert.equal(mailCalls[0].body, mailCalls[1].body);
  assert.equal(mailCalls[0].headers['Idempotency-Key'], mailCalls[1].headers['Idempotency-Key']);
});

test('CORS accepts only exact origin and requested POST/Content-Type', async () => {
  const service = provider([]);
  for (const origin of ['', 'https://www.studiob.bar', 'https://studiob.bar.evil.invalid', 'http://studiob.bar']) {
    const response = await handleRequest(request(booking, { Origin: origin }), env, service);
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
  }
  const preflight = await handleRequest(request(null, {
    'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'content-type',
  }, 'OPTIONS'), env, service);
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), env.ALLOWED_ORIGIN);
  assert.equal(preflight.headers.get('Access-Control-Allow-Credentials'), null);
  const invalid = await handleRequest(request(null, {
    'Access-Control-Request-Method': 'DELETE',
  }, 'OPTIONS'), env, service);
  assert.equal(invalid.status, 403);
  assert.equal(service.calls.length, 0);
});

test('missing configuration fails closed without challenge or mail requests', async () => {
  for (const key of ['ALLOWED_ORIGIN', 'RESEND_API_KEY', 'RESERVATION_TO', 'MAIL_FROM', 'TURNSTILE_SECRET_KEY']) {
    const service = provider([]);
    const response = await handleRequest(request(), { ...env, [key]: '' }, service);
    assert.equal(response.status, 503, key);
    assert.equal(service.calls.length, 0);
  }
});

test('field bounds, header injection, honeypot and recipient overrides stop before providers', async () => {
  const invalid = [
    { guests: 0 }, { guests: 21 }, { guests: true }, { guests: '2.5' },
    { name: 'Guest\r\nBcc: intruder@example.invalid' },
    { email: 'guest@example.invalid\nBcc:intruder@example.invalid' },
    { email: 'two@example.invalid,other@example.invalid' },
    { phone: '+123456' }, { phone: '+1234567890123456' },
    { note: 'x'.repeat(1001) }, { note: 'bad\u0000value' },
    { date: '2026-02-30' }, { date: '2026-1-2' },
    { time: '08:30' }, { time: '18:15' }, { time: '24:00' },
    { requestId: 'not-a-uuid' }, { website: 'bot' },
    { language: 'xx' }, { turnstileToken: '' },
    { to: 'attacker@example.invalid' },
  ];
  for (const patch of invalid) {
    const service = provider([]);
    const response = await handleRequest(request({ ...booking, ...patch }), env, { ...service, now });
    assert.equal(response.status, 400, Object.keys(patch).join(','));
    assert.equal(service.calls.length, 0);
  }
});

test('past slots and 180-day limit use Berlin local date and daylight saving', async () => {
  const cases = [
    ['2026-10-20T10:00:20Z', '2026-10-20', '12:00', 400],
    ['2026-10-20T10:00:20Z', '2026-10-20', '12:30', 200],
    ['2026-10-20T22:30:00Z', '2026-10-20', '23:30', 400],
    ['2026-10-20T22:30:00Z', '2026-10-21', '09:00', 200],
    ['2026-10-26T08:30:00Z', '2026-10-26', '09:30', 400],
    ['2026-10-26T08:30:00Z', '2026-10-26', '10:00', 200],
    ['2026-10-20T10:00:00Z', '2027-04-19', '18:30', 400],
  ];
  for (const [instant, date, time, expected] of cases) {
    const service = provider(expected === 200 ? [json(challenge), json({ id: 'id' })] : []);
    const response = await handleRequest(request({ ...booking, date, time }), env, {
      ...service, now: new Date(instant),
    });
    assert.equal(response.status, expected, `${instant} / ${date} ${time}`);
  }
});

test('header size and actual UTF-8 body bytes are independently limited', async () => {
  for (const incoming of [
    request(booking, { 'Content-Length': '8193' }),
    request(' '.repeat(8193), { 'Content-Length': '2' }),
    request(JSON.stringify({ note: '😀'.repeat(2100) })),
  ]) {
    const service = provider([]);
    const response = await handleRequest(incoming, env, { ...service, now });
    assert.equal(response.status, 413);
    assert.equal(service.calls.length, 0);
  }
  const malformed = await handleRequest(request('{"broken"'), env, { ...provider([]), now });
  assert.equal(malformed.status, 400);
});

test('challenge success requires matching hostname and reservation action', async () => {
  for (const result of [
    { ...challenge, success: false },
    { ...challenge, hostname: 'other.invalid' },
    { ...challenge, action: 'login' },
    { ...challenge, success: 'true' },
  ]) {
    const service = provider([json(result)]);
    const response = await handleRequest(request(), env, { ...service, now });
    assert.equal(response.status, 403);
    assert.equal(service.calls.length, 1);
  }
  const failed = provider([new TypeError('Simulated failure')]);
  const response = await handleRequest(request(), env, { ...failed, now });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).deliveryUnknown, false);
});

test('mail provider errors, malformed replies and transport failures never return success', async () => {
  for (const [failure, unknown] of [
    [json({ message: 'Bad sender' }, 422), false],
    [json({ message: 'Rate limited' }, 429), false],
    [json({ message: 'Conflict' }, 409), true],
    [json({ message: 'Server error' }, 500), true],
    [json({}), true],
    [new Response('not JSON'), true],
    [new TypeError('Simulated network error'), true],
  ]) {
    const service = provider([json(challenge), failure]);
    const response = await handleRequest(request(), env, { ...service, now });
    assert.ok(response.status >= 400);
    const body = await response.json();
    assert.equal(body.success, false);
    assert.equal(body.deliveryUnknown, unknown);
    assert.equal(service.calls.length, 2);
    assert.doesNotMatch(JSON.stringify(body), /Bad sender|guest@|test-key|test-secret/);
  }
});

test('mail timeout aborts and reports an uncertain outcome without retrying', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let ready;
  const enteredMail = new Promise((resolve) => { ready = resolve; });
  let calls = 0;
  const fetcher = async (url, options) => {
    calls += 1;
    if (calls === 1) return json(challenge);
    return new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('Aborted')));
      ready();
    });
  };
  const pending = handleRequest(request(), env, { fetcher, now });
  await enteredMail;
  t.mock.timers.tick(10000);
  const response = await pending;
  assert.equal(response.status, 502);
  assert.equal((await response.json()).deliveryUnknown, true);
  assert.equal(calls, 2);
});

function browser(t, origin, endpoint, responses = []) {
  const originals = new Map(['window', 'location', 'fetch'].map((key) =>
    [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const service = provider(responses);
  for (const [key, value] of Object.entries({
    window: { STUDIO_B_CONFIG: { reservationEndpoint: endpoint } },
    location: { origin },
    fetch: service.fetcher,
  })) {
    Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  }
  t.after(() => {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  return service.calls;
}

test('frontend preview makes no network calls even with a configured live endpoint', async (t) => {
  const calls = browser(t, 'http://127.0.0.1:8766', 'https://worker.example.invalid/reservations');
  assert.deepEqual(await submitReservation(booking), { preview: true });
  assert.equal(calls.length, 0);
});

test('frontend with no endpoint does not fake a successful submission', async (t) => {
  const calls = browser(t, 'https://studiob.bar', '');
  assert.deepEqual(await submitReservation(booking), { preview: true });
  assert.equal(calls.length, 0);
});

test('frontend accepts only matching request ID plus positive HTTP/JSON result', async (t) => {
  const calls = browser(t, 'https://studiob.bar', 'https://worker.example.invalid/reservations', [
    json({ success: true, requestId: booking.requestId }),
  ]);
  const result = await submitReservation({ ...booking, language: 'en', to: 'ignored@example.invalid' });
  assert.equal(result.success, true);
  assert.match(result.message, /only after Studio B/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.credentials, 'omit');
  assert.equal(calls[0].options.redirect, 'error');
  assert.equal(JSON.parse(calls[0].options.body).to, undefined);
});

test('frontend localizes challenge errors and marks ambiguous results', async (t) => {
  browser(t, 'https://studiob.bar', 'https://worker.example.invalid/reservations', [
    json({ success: false, error: 'challenge_failed', deliveryUnknown: false }, 403),
    json({ success: true, requestId: 'wrong-id' }),
    new TypeError('Simulated network failure'),
  ]);
  await assert.rejects(submitReservation({ ...booking, language: 'tr' }), (error) => {
    assert.equal(error.code, 'challenge_failed');
    assert.match(error.message, /spam kontrolünü/);
    return true;
  });
  await assert.rejects(submitReservation(booking), { deliveryUnknown: true });
  await assert.rejects(submitReservation(booking), { deliveryUnknown: true });
});
