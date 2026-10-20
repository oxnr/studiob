const MAX_BODY_BYTES = 8192;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@<>(),;:"\\\u0000-\u001f\u007f]{1,64}@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/i;
const CONTROL = /[\u0000-\u001f\u007f]/;

function fail(code, status = 400) {
  throw Object.assign(new Error(code), { code, status });
}

function reply(status, body, origin) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    Vary: 'Origin',
  };
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  return new Response(JSON.stringify(body), { status, headers });
}

function allowedOrigin(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.origin === value ? value : null;
  } catch {
    return null;
  }
}

function validEmail(value) {
  return typeof value === 'string' && value.length <= 254 && EMAIL.test(value);
}

async function readBody(request) {
  const size = request.headers.get('Content-Length');
  if (size && (!/^\d+$/.test(size) || Number(size) > MAX_BODY_BYTES)) {
    fail('payload_too_large', 413);
  }
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || '')) {
    fail('invalid_json', 415);
  }
  if (!request.body) fail('invalid_json');
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel();
        fail('payload_too_large', 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    fail('invalid_json');
  }
}

function validate(input, now) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('invalid_input');
  const fields = new Set([
    'guests', 'date', 'time', 'name', 'phone', 'email', 'note', 'website',
    'language', 'requestId', 'turnstileToken',
  ]);
  if (Object.keys(input).some((key) => !fields.has(key))) fail('invalid_input');
  const text = (key, max, min = 0, multiline = false) => {
    const value = input[key] ?? '';
    if (typeof value !== 'string' || value.length > max) fail('invalid_input');
    const result = value.trim();
    if (result.length < min || (multiline
      ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(result)
      : CONTROL.test(value))) fail('invalid_input');
    return result;
  };

  const website = text('website', 200);
  if (website) fail('bot_detected');
  const name = text('name', 100, 2);
  const email = text('email', 254, 3);
  if (!validEmail(email)) fail('invalid_input');
  const phone = text('phone', 40, 6);
  const phoneDigits = phone.replace(/\D/g, '').length;
  if (!/^[+\d(). -]+$/.test(phone) || phoneDigits < 7 || phoneDigits > 15) fail('invalid_input');
  const note = text('note', 1000, 0, true);
  const requestId = text('requestId', 36, 36);
  if (!UUID.test(requestId)) fail('invalid_input');
  const turnstileToken = text('turnstileToken', 2048);
  if (!turnstileToken) fail('challenge_required');
  const language = input.language ?? 'de';
  if (!['de', 'en', 'tr'].includes(language)) fail('invalid_input');
  if (typeof input.guests !== 'number' && typeof input.guests !== 'string') fail('invalid_input');
  if (typeof input.guests === 'string' && !/^\d{1,2}$/.test(input.guests)) fail('invalid_input');
  const guests = Number(input.guests);
  if (!Number.isInteger(guests) || guests < 1 || guests > 20) fail('invalid_input');

  const date = text('date', 10, 10);
  const time = text('time', 5, 5);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:(00|30)$/.test(time)) fail('invalid_input');
  const calendarDate = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(calendarDate.getTime()) || calendarDate.toISOString().slice(0, 10) !== date) {
    fail('invalid_input');
  }
  if (time < '09:00' || time > '23:30') fail('invalid_input');
  const berlin = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(now).map(({ type, value }) => [type, value]),
  );
  const today = `${berlin.year}-${berlin.month}-${berlin.day}`;
  const localTime = `${berlin.hour}:${berlin.minute}`;
  if (date < today || (date === today && time <= localTime)) fail('past_slot');
  const daysAhead = (calendarDate.getTime() - Date.parse(`${today}T00:00:00Z`)) / 86400000;
  if (daysAhead > 180) fail('date_too_far');
  return { guests, date, time, name, phone, email, note, language, requestId, turnstileToken };
}

async function providerRequest(url, options, fetcher) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetcher(url, { ...options, redirect: 'error', signal: controller.signal });
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } finally {
    clearTimeout(timer);
  }
}

export async function handleRequest(request, env, { fetcher = fetch, now = new Date() } = {}) {
  const origin = allowedOrigin(env.ALLOWED_ORIGIN);
  const cors = origin && request.headers.get('Origin') === origin ? origin : null;
  const error = (code, status, deliveryUnknown = false) =>
    reply(status, { success: false, error: code, deliveryUnknown }, cors);

  if (new URL(request.url).pathname !== '/reservations') return error('not_found', 404);
  if (!origin) return error('configuration_missing', 503);
  if (!cors) return error('origin_not_allowed', 403);
  if (request.method === 'OPTIONS') {
    const requestedHeaders = (request.headers.get('Access-Control-Request-Headers') || '')
      .toLowerCase().split(',').map((value) => value.trim()).filter(Boolean);
    if (request.headers.get('Access-Control-Request-Method') !== 'POST' ||
        requestedHeaders.some((value) => value !== 'content-type')) {
      return error('origin_not_allowed', 403);
    }
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '600',
        Vary: 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers',
      },
    });
  }
  if (request.method !== 'POST') return error('method_not_allowed', 405);
  if (!env.RESEND_API_KEY || !env.TURNSTILE_SECRET_KEY ||
      !validEmail(env.RESERVATION_TO) || !validEmail(env.MAIL_FROM)) {
    return error('configuration_missing', 503);
  }

  let booking;
  try {
    booking = validate(await readBody(request), now);
  } catch (problem) {
    return error(problem.code || 'invalid_input', problem.status || 400);
  }

  let challenge;
  try {
    challenge = await providerRequest('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET_KEY,
        response: booking.turnstileToken,
      }),
    }, fetcher);
  } catch {
    return error('challenge_unavailable', 503);
  }
  if (!challenge.ok || challenge.data?.success !== true ||
      challenge.data.hostname !== new URL(origin).hostname ||
      challenge.data.action !== 'reservation') {
    return error('challenge_failed', 403);
  }

  const email = {
    from: env.MAIL_FROM,
    to: [env.RESERVATION_TO],
    reply_to: booking.email,
    subject: `Studio B · Reservierungsanfrage · ${booking.date} ${booking.time}`,
    text: [
      'Neue Reservierungsanfrage für Studio B',
      'Bitte Verfügbarkeit prüfen und dem Gast persönlich antworten.',
      'Diese Anfrage ist noch keine bestätigte Reservierung.',
      '',
      `Datum: ${booking.date}`,
      `Uhrzeit: ${booking.time} (Europe/Berlin)`,
      `Personen: ${booking.guests}`,
      `Name: ${booking.name}`,
      `Telefon: ${booking.phone}`,
      `E-Mail: ${booking.email}`,
      `Sprache: ${booking.language}`,
      '',
      `Notiz: ${booking.note || 'Keine'}`,
      '',
      `Anfrage-ID: ${booking.requestId}`,
    ].join('\n'),
  };
  let sent;
  try {
    sent = await providerRequest('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `studio-b-reservation/${booking.requestId}`,
      },
      body: JSON.stringify(email),
    }, fetcher);
  } catch {
    return error('mail_unavailable', 502, true);
  }
  if (!sent.ok) {
    return error(
      sent.status === 409 ? 'request_conflict' : 'mail_rejected',
      sent.status === 409 ? 409 : 502,
      sent.status >= 500 || sent.status === 409,
    );
  }
  if (typeof sent.data?.id !== 'string' || !sent.data.id) {
    return error('mail_unavailable', 502, true);
  }
  return reply(200, { success: true, requestId: booking.requestId }, cors);
}

export default { fetch: (request, env) => handleRequest(request, env) };
