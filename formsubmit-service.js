const PUBLIC_ENDPOINT = /^https:\/\/formsubmit\.co\/ajax\/[A-Za-z0-9_-]{20,128}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@<>(),;:"\\\u0000-\u001f\u007f]{1,64}@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/i;
const messages = {
  de: {
    invalid_input: 'Bitte prüfe deine Reservierungsangaben.',
    past_slot: 'Bitte wähle einen Termin in der Zukunft.',
    date_too_far: 'Reservierungsanfragen sind bis zu 180 Tage im Voraus möglich.',
    activation_required: 'Der E-Mail-Versand wird noch eingerichtet. Bitte reserviere telefonisch bei Studio B.',
    unavailable: 'Die Anfrage kann gerade nicht gesendet werden. Bitte rufe Studio B an.',
    unknown: 'Der Versand konnte nicht bestätigt werden. Bitte rufe Studio B an, bevor du erneut anfragst.',
    accepted: 'Deine Anfrage wurde an den Versanddienst übergeben. Dein Tisch ist erst nach persönlicher Bestätigung durch Studio B reserviert.',
  },
  en: {
    invalid_input: 'Please check your reservation details.',
    past_slot: 'Please choose a future date and time.',
    date_too_far: 'Reservations can be requested up to 180 days ahead.',
    activation_required: 'Email delivery is still being set up. Please call Studio B to reserve.',
    unavailable: 'Your request cannot be sent right now. Please call Studio B.',
    unknown: 'We could not confirm that your request was sent. Please call Studio B before submitting again.',
    accepted: 'Your request was accepted by the mail service. Your table is reserved only after Studio B personally confirms it.',
  },
  tr: {
    invalid_input: 'Lütfen rezervasyon bilgilerinizi kontrol edin.',
    past_slot: 'Lütfen gelecekteki bir tarih ve saat seçin.',
    date_too_far: 'En fazla 180 gün sonrası için rezervasyon talebi gönderilebilir.',
    activation_required: 'E-posta gönderimi henüz hazırlanıyor. Rezervasyon için lütfen Studio B’yi arayın.',
    unavailable: 'Talebiniz şu anda gönderilemiyor. Lütfen Studio B’yi arayın.',
    unknown: 'Talebinizin gönderildiği doğrulanamadı. Tekrar göndermeden önce lütfen Studio B’yi arayın.',
    accepted: 'Talebiniz e-posta hizmeti tarafından kabul edildi. Rezervasyonunuz ancak Studio B’nin kişisel onayından sonra kesinleşir.',
  },
};

function requestError(code, language, deliveryUnknown = false) {
  const copy = messages[language] || messages.de;
  return Object.assign(new Error(copy[deliveryUnknown ? 'unknown' : code] || copy.unavailable), {
    code, deliveryUnknown,
  });
}

function validate(values, language, now) {
  const invalid = () => { throw requestError('invalid_input', language); };
  const text = (key, max, min = 0, multiline = false) => {
    const value = values[key] ?? '';
    if (typeof value !== 'string' || value.length > max) invalid();
    if ((multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/ : /[\u0000-\u001f\u007f]/).test(value)) invalid();
    const trimmed = value.trim();
    if (trimmed.length < min) invalid();
    return trimmed;
  };
  const name = text('name', 100, 2);
  const email = text('email', 254, 3);
  if (!EMAIL.test(email)) invalid();
  const phone = text('phone', 40, 7);
  if (!/^[+\d(). -]+$/.test(phone) || !/^\d{7,15}$/.test(phone.replace(/\D/g, ''))) invalid();
  const note = text('note', 1000, 0, true);
  const website = text('website', 200);
  if (website) invalid();
  const requestId = text('requestId', 36, 36);
  if (!UUID.test(requestId)) invalid();
  if (!['number', 'string'].includes(typeof values.guests) ||
      !/^\d{1,2}$/.test(String(values.guests))) invalid();
  const guests = Number(values.guests);
  if (guests < 1 || guests > 20) invalid();
  const date = text('date', 10, 10);
  const time = text('time', 5, 5);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:(00|30)$/.test(time) ||
      time < '09:00' || time > '23:30') invalid();
  const calendarDate = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(calendarDate.getTime()) || calendarDate.toISOString().slice(0, 10) !== date) invalid();
  const berlin = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map(({ type, value }) => [type, value]));
  const today = `${berlin.year}-${berlin.month}-${berlin.day}`;
  if (date < today || (date === today && time <= `${berlin.hour}:${berlin.minute}`)) {
    throw requestError('past_slot', language);
  }
  if ((calendarDate.getTime() - Date.parse(`${today}T00:00:00Z`)) / 86400000 > 180) {
    throw requestError('date_too_far', language);
  }
  return { name, email, phone, note, website, requestId, guests, date, time };
}

/**
 * No live requests from previews. FormSubmit does not guarantee idempotency:
 * requestId is correspondence metadata only, and this adapter never retries.
 * Validation here improves UX; it is not a substitute for provider-side controls.
 */
export async function submitReservation(values, { now = new Date() } = {}) {
  const endpoint = globalThis.window?.STUDIO_B_CONFIG?.reservationEndpoint;
  if (globalThis.location?.origin !== 'https://studiob.bar') return { preview: true };
  const language = ['de', 'en', 'tr'].includes(values?.language) ? values.language : 'de';
  // Only a configured public, opaque form ID is allowed; never publish a recipient address.
  if (typeof endpoint !== 'string' || endpoint !== endpoint.trim() || !PUBLIC_ENDPOINT.test(endpoint)) {
    throw requestError('configuration_missing', language);
  }
  if (!values || typeof values !== 'object' || Array.isArray(values)) throw requestError('invalid_input', language);
  const booking = validate(values, language, now);
  // Whitelist every transmitted field: caller-supplied _cc, recipient, etc. are never forwarded.
  const payload = {
    name: booking.name,
    email: booking.email,
    Datum: booking.date.split('-').reverse().join('.'),
    Uhrzeit: `${booking.time} (Europe/Berlin)`,
    Personen: booking.guests,
    Telefon: booking.phone,
    Nachricht: booking.note || 'Keine',
    Sprache: language,
    'Anfrage-ID': booking.requestId,
    Hinweis: 'Reservierungsanfrage, noch keine bestätigte Buchung. Bitte Verfügbarkeit prüfen und dem Gast persönlich antworten.',
    _subject: `Studio B · Reservierungsanfrage · ${booking.date} ${booking.time} · ${booking.requestId}`,
    _template: 'table',
    _url: 'https://studiob.bar/#reservieren',
    _honey: booking.website,
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  let response;
  let result;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
      signal: controller.signal,
    });
    result = await response.json();
  } catch {
    throw requestError('network_error', language, true);
  } finally {
    clearTimeout(timeout);
  }
  const message = typeof result?.message === 'string' ? result.message : '';
  if (/\bactivat(?:e|ed|ion)\b/i.test(message)) throw requestError('activation_required', language);
  if (!response.ok || ![true, 'true'].includes(result?.success) ||
      !/^The form was submitted successfully\.?$/i.test(message.trim())) {
    throw requestError('provider_error', language,
      response.status >= 500 || (response.ok && ![false, 'false'].includes(result?.success)));
  }
  return { preview: false, success: true, requestId: booking.requestId, message: messages[language].accepted };
}
