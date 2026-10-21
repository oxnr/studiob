import assert from 'node:assert/strict';
import test from 'node:test';
import { submitReservation } from '../formsubmit-service.js';
import { decodeReplyFragment } from '../reservation-reply.js';

const endpoint = 'https://formsubmit.co/ajax/test_form_id_not_a_real_id_12345678';
const now = new Date('2026-10-20T10:00:00Z');
const booking = {
  name: 'Example Guest', email: 'guest@example.invalid', phone: '+49 30 1234567',
  guests: '2', date: '2026-10-21', time: '18:30', note: 'Window seat',
  website: '', language: 'de', requestId: '550e8400-e29b-41d4-a716-446655440000',
};
const success = { success: 'true', message: 'The form was submitted successfully.' };
const activation = {
  success: 'false',
  message: "This form needs Activation. We've sent you an email containing an 'Activate Form' link. Just click it and your form will be actived!",
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

function browser(t, responses = [], origin = 'https://studiob.bar', configured = endpoint) {
  const originals = new Map(['window', 'location', 'fetch'].map(key =>
    [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    assert.ok(responses.length, 'Unexpected external request');
    const result = responses.shift();
    if (result instanceof Error) throw result;
    return typeof result === 'function' ? result(url, options) : result;
  };
  for (const [key, value] of Object.entries({
    window: { STUDIO_B_CONFIG: { reservationEndpoint: configured } },
    location: { origin }, fetch: fetcher,
  })) Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  t.after(() => {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  return calls;
}

test('previews send nothing; missing live configuration fails instead of claiming preview success', async t => {
  const calls = browser(t, [], 'http://127.0.0.1:8767');
  assert.deepEqual(await submitReservation(booking, { now }), { preview: true });
  globalThis.location.origin = 'https://preview.example.invalid';
  assert.deepEqual(await submitReservation(booking, { now }), { preview: true });
  globalThis.location.origin = 'https://studiob.bar';
  globalThis.window.STUDIO_B_CONFIG.reservationEndpoint = '';
  await assert.rejects(submitReservation(booking, { now }), { code: 'configuration_missing' });
  assert.equal(calls.length, 0);
});

test('only HTTPS FormSubmit endpoints with public opaque form IDs are allowed', async t => {
  const calls = browser(t);
  for (const value of [
    'https://formsubmit.co/ajax/other@example.invalid', `${endpoint}?cc=other@example.invalid`,
    `http://${endpoint.slice(8)}`, `${endpoint}/`, 'https://attacker.invalid/reservations',
    '', undefined, null, 123, 'https://formsubmit.co/ajax/too-short',
    `https://formsubmit.co/ajax/${'x'.repeat(129)}`, `${endpoint}\n`,
    `${endpoint}#fragment`, endpoint.replace('/ajax/', '/ajax/user%40example.invalid/'),
    endpoint.replace('formsubmit.co/', 'formsubmit.co.attacker.invalid/'),
  ]) {
    globalThis.window.STUDIO_B_CONFIG.reservationEndpoint = value;
    await assert.rejects(submitReservation(booking, { now }), { code: 'configuration_missing' });
  }
  assert.equal(calls.length, 0);
});

test('payload contains booking details and reply-to email but no recipient overrides or tracker fields', async t => {
  const calls = browser(t, [json(success)]);
  const result = await submitReservation({
    ...booking, _cc: 'attacker@example.invalid', _next: 'https://attacker.invalid',
    _captcha: 'false', to: 'attacker@example.invalid', turnstileToken: 'not-transmitted',
    reservationEndpoint: 'https://formsubmit.co/ajax/ignored_fake_form_id_12345678',
    'Anfrage beantworten': 'https://attacker.invalid/',
  }, { now });
  assert.equal(result.success, true);
  assert.equal(result.requestId, booking.requestId);
  assert.match(result.message, /erst nach persönlicher Bestätigung/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, endpoint);
  assert.equal(calls[0].options.redirect, 'error');
  assert.equal(calls[0].options.credentials, 'omit');
  const payload = JSON.parse(calls[0].options.body);
  assert.equal(payload.email, booking.email);
  assert.equal(payload.Datum, '21.10.2026');
  assert.equal(payload.Uhrzeit, '18:30 (Europe/Berlin)');
  assert.equal(payload.Personen, 2);
  assert.equal(payload['Anfrage-ID'], booking.requestId);
  const replyLink = new URL(payload['Anfrage beantworten']);
  assert.equal(replyLink.origin, 'https://studiob.bar');
  assert.equal(replyLink.pathname, '/reply.html');
  assert.equal(replyLink.search, '');
  const reply = decodeReplyFragment(replyLink.hash);
  assert.equal(reply.email, booking.email);
  assert.equal(reply.requestId, booking.requestId);
  assert.equal(reply.guests, 2);
  assert.equal(reply.phone, undefined);
  assert.equal(reply.note, undefined);
  assert.equal(payload._honey, '');
  assert.equal(payload._template, 'table');
  assert.equal(payload._url, 'https://studiob.bar/#reservieren');
  assert.match(payload._subject, /2026-10-21 18:30/);
  for (const key of ['_cc', '_next', '_captcha', 'to', 'turnstileToken', 'reservationEndpoint']) {
    assert.equal(payload[key], undefined);
  }
});

test('activation never looks like a sent reservation, even with a truthy success field', async t => {
  const calls = browser(t, [json(activation), json({ ...activation, success: 'true' })]);
  for (const language of ['de', 'tr']) {
    await assert.rejects(submitReservation({ ...booking, language }, { now }), error => {
      assert.equal(error.code, 'activation_required');
      assert.equal(error.deliveryUnknown, false);
      assert.match(error.message, language === 'de' ? /telefonisch/ : /arayın/);
      return true;
    });
  }
  assert.equal(calls.length, 2);
});

test('valid addresses unsupported by the draft helper still deliver with a direct reply fallback', async t => {
  const calls = browser(t, [json(success)]);
  const result = await submitReservation({ ...booking, email: 'guest%tag@example.invalid' }, { now });
  assert.equal(result.success, true);
  const payload = JSON.parse(calls[0].options.body);
  assert.equal(payload.email, 'guest%tag@example.invalid');
  assert.match(payload['Anfrage beantworten'], /^Bitte direkt auf diese E-Mail antworten/);
  assert.doesNotMatch(payload['Anfrage beantworten'], /https:/);
});

test('invalid inputs and honeypot are rejected before network activity', async t => {
  const calls = browser(t);
  for (const patch of [
    { guests: 0 }, { guests: 21 }, { guests: true }, { guests: '2.5' },
    { name: 'Guest\r\nBcc: other@example.invalid' }, { name: 'x' },
    { email: 'guest@example.invalid\nBcc:other@example.invalid' },
    { email: 'two@example.invalid,other@example.invalid' },
    { phone: '+123456' }, { phone: '+1234567890123456' },
    { note: 'x'.repeat(1001) }, { note: 'bad\u0000value' },
    { date: '2026-02-30' }, { date: '2026-1-2' },
    { time: '08:30' }, { time: '18:15' }, { time: '24:00' },
    { requestId: 'not-a-uuid' }, { website: 'bot' },
  ]) await assert.rejects(submitReservation({ ...booking, ...patch }, { now }), { code: 'invalid_input' });
  await assert.rejects(submitReservation(null, { now }), { code: 'invalid_input' });
  assert.equal(calls.length, 0);
});

test('Berlin dates account for midnight, daylight saving and 180-day bounds', async t => {
  const calls = browser(t, [json(success), json(success), json(success)]);
  for (const [instant, date, time, code] of [
    ['2026-10-20T10:00:20Z', '2026-10-20', '12:00', 'past_slot'],
    ['2026-10-20T10:00:20Z', '2026-10-20', '12:30', null],
    ['2026-10-20T22:30:00Z', '2026-10-20', '23:30', 'past_slot'],
    ['2026-10-20T22:30:00Z', '2026-10-21', '09:00', null],
    ['2026-10-26T08:30:00Z', '2026-10-26', '09:30', 'past_slot'],
    ['2026-10-26T08:30:00Z', '2026-10-26', '10:00', null],
    ['2026-10-20T10:00:00Z', '2027-04-19', '18:30', 'date_too_far'],
  ]) {
    const submission = submitReservation({ ...booking, date, time }, { now: new Date(instant) });
    if (code) await assert.rejects(submission, { code });
    else assert.equal((await submission).success, true);
  }
  assert.equal(calls.length, 3);
});

test('provider errors, malformed responses and unknown success shapes fail without retries', async t => {
  const failures = [
    [json({ success: 'false', message: 'Rejected' }), false],
    [json({ success: false }, 429), false],
    [json({ success: false }, 500), true],
    [json({ success: 'true' }), true],
    [json({ success: true, message: 'Please confirm your email' }), true],
    [json({}), true],
    [new Response('<html>Error</html>'), true],
    [new TypeError('Network failure'), true],
  ];
  const calls = browser(t, failures.map(([response]) => response));
  for (const [, deliveryUnknown] of failures) {
    await assert.rejects(submitReservation({ ...booking, language: 'en' }, { now }), error => {
      assert.equal(error.deliveryUnknown, deliveryUnknown);
      assert.match(error.message, /Please call Studio B/);
      return true;
    });
  }
  assert.equal(calls.length, failures.length);
});

test('timeout aborts once and reports uncertain delivery without automatic retry', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const calls = browser(t, [async (url, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('Aborted')));
  })]);
  const pending = submitReservation(booking, { now });
  const rejected = assert.rejects(pending, { deliveryUnknown: true, code: 'network_error' });
  t.mock.timers.tick(25000);
  await rejected;
  assert.equal(calls.length, 1);
});
