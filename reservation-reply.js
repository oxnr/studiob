const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@<>(),;:"\\%\u0000-\u001f\u007f]{1,64}@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/i;
const KEYS = ['v', 'name', 'email', 'date', 'time', 'guests', 'language', 'requestId'];
const CONTROL = /[\u0000-\u001f\u007f]/;
const invalid = () => { throw new Error('Die Angaben sind unvollständig oder ungültig. Bitte öffne den Antwortlink aus der Reservierungs-E-Mail erneut.'); };

function text(value, min, max) {
  if (typeof value !== 'string' || value.length > max || CONTROL.test(value) || value.trim().length < min) invalid();
  return value.trim();
}

function slot(date, time) {
  if (typeof date !== 'string' || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(date) ||
      typeof time !== 'string' || !/^([01]\d|2[0-3]):(00|30)$/.test(time)) invalid();
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) invalid();
  return { date, time };
}

function validate(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || data.v !== 1 ||
      Object.keys(data).some(key => !KEYS.includes(key))) invalid();
  const name = text(data.name, 2, 100);
  const email = text(data.email, 3, 254);
  if (!EMAIL.test(email) || !Number.isInteger(data.guests) || data.guests < 1 || data.guests > 20 ||
      !['de', 'en', 'tr'].includes(data.language) || typeof data.requestId !== 'string' || !UUID.test(data.requestId)) invalid();
  return Object.freeze({ v: 1, name, email, ...slot(data.date, data.time), guests: data.guests,
    language: data.language, requestId: data.requestId });
}

/** Only correspondence data belongs in this link; never notes, phone numbers or secrets. */
export function createReplyLink(values) {
  const data = validate({ v: 1, name: values.name, email: values.email, date: values.date,
    time: values.time, guests: Number(values.guests), language: values.language, requestId: values.requestId });
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  const encoded = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `https://studiob.bar/reply.html#v1=${encoded}`;
}

export function decodeReplyFragment(fragment) {
  if (typeof fragment !== 'string' || fragment.length > 2400 || !/^#v1=[A-Za-z0-9_-]+$/.test(fragment)) invalid();
  try {
    const encoded = fragment.slice(4).replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
    return validate(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
  } catch { invalid(); }
}

/** Civil Berlin date/time arithmetic, independent of the owner's device time zone. */
export function shiftReservationSlot(booking, minutes) {
  slot(booking.date, booking.time);
  if (![-30, 30].includes(minutes)) invalid();
  const date = new Date(`${booking.date}T${booking.time}:00Z`);
  date.setUTCMinutes(date.getUTCMinutes() + minutes);
  return slot(date.toISOString().slice(0, 10), date.toISOString().slice(11, 16));
}

export function formatReplyDate(date, language = 'de') {
  slot(date, '12:00');
  return new Intl.DateTimeFormat({ de: 'de-DE', en: 'en-GB', tr: 'tr-TR' }[language] || 'de-DE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
}

export function createReplyDraft(booking, action, options = {}) {
  const data = validate(booking);
  if (!['accept', 'reject', 'earlier', 'later', 'custom', 'question'].includes(action)) invalid();
  const alternative = action === 'earlier' || action === 'later'
    ? shiftReservationSlot(data, action === 'earlier' ? -30 : 30)
    : action === 'custom' ? slot(options.date, options.time) : null;
  let question = '';
  if (action === 'question') {
    if (typeof options.question !== 'string' || options.question.length > 1500 ||
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(options.question) || !options.question.trim()) {
      throw new Error('Bitte gib deine Rückfrage ein.');
    }
    question = options.question.trim();
  }
  const original = formatReplyDate(data.date, data.language);
  const proposed = alternative ? formatReplyDate(alternative.date, data.language) : '';
  const count = data.guests;
  const replies = {
    de: {
      subject: `Studio B · Deine Tischanfrage · ${data.date} ${data.time}`,
      greeting: `Hallo ${data.name},`,
      accept: `wir bestätigen deinen Tisch für ${count} ${count === 1 ? 'Person' : 'Personen'} am ${original} um ${data.time} Uhr. Wir freuen uns auf deinen Besuch!`,
      reject: `vielen Dank für deine Anfrage für ${count} ${count === 1 ? 'Person' : 'Personen'} am ${original} um ${data.time} Uhr. Leider können wir für diesen Termin keinen Tisch anbieten. Vielleicht klappt es ein anderes Mal.`,
      proposal: `vielen Dank für deine Anfrage für ${count} ${count === 1 ? 'Person' : 'Personen'} am ${original} um ${data.time} Uhr. Wäre stattdessen ${proposed} um ${alternative?.time} Uhr für dich möglich? Bitte antworte uns kurz. Dies ist ein Terminvorschlag; der Tisch ist noch nicht bestätigt.`,
      question: `vielen Dank für deine Anfrage für ${count} ${count === 1 ? 'Person' : 'Personen'} am ${original} um ${data.time} Uhr.\n\n${question}\n\nBitte antworte uns kurz. Dein Tisch ist noch nicht bestätigt.`,
      closing: 'Liebe Grüße\nDein Studio-B-Team', zone: 'Alle Uhrzeiten: Berliner Ortszeit.', id: 'Anfrage-ID',
    },
    en: {
      subject: `Studio B · Your table request · ${data.date} ${data.time}`,
      greeting: `Hi ${data.name},`,
      accept: `your table for ${count} ${count === 1 ? 'guest' : 'guests'} on ${original} at ${data.time} is confirmed. We look forward to welcoming you!`,
      reject: `thank you for your request for ${count} ${count === 1 ? 'guest' : 'guests'} on ${original} at ${data.time}. Unfortunately, we cannot offer a table at that time. We hope to welcome you another time.`,
      proposal: `thank you for your request for ${count} ${count === 1 ? 'guest' : 'guests'} on ${original} at ${data.time}. Would ${proposed} at ${alternative?.time} work for you instead? Please reply to let us know. This is a suggested time; your table is not confirmed yet.`,
      question: `thank you for your request for ${count} ${count === 1 ? 'guest' : 'guests'} on ${original} at ${data.time}.\n\n${question}\n\nPlease reply to let us know. Your table is not confirmed yet.`,
      closing: 'Best wishes,\nYour Studio B team', zone: 'All times are local Berlin time.', id: 'Request ID',
    },
    tr: {
      subject: `Studio B · Masa talebiniz · ${data.date} ${data.time}`,
      greeting: `Merhaba ${data.name},`,
      accept: `${original} günü saat ${data.time} için ${count} kişilik masa rezervasyonunuzu onaylıyoruz. Sizi ağırlamaktan mutluluk duyarız!`,
      reject: `${original} günü saat ${data.time} için ${count} kişilik masa talebiniz için teşekkür ederiz. Ne yazık ki bu tarih ve saatte masa sunamıyoruz. Sizi başka bir zaman ağırlamayı umuyoruz.`,
      proposal: `${original} günü saat ${data.time} için ${count} kişilik masa talebiniz için teşekkür ederiz. Bunun yerine ${proposed} günü saat ${alternative?.time} sizin için uygun olur mu? Lütfen bize yanıt verin. Bu yalnızca bir tarih ve saat önerisidir; rezervasyonunuz henüz onaylanmamıştır.`,
      question: `${original} günü saat ${data.time} için ${count} kişilik masa talebiniz için teşekkür ederiz.\n\n${question}\n\nLütfen bize yanıt verin. Rezervasyonunuz henüz onaylanmamıştır.`,
      closing: 'Sevgiler,\nStudio B ekibi', zone: 'Tüm saatler Berlin yerel saatidir.', id: 'Talep kimliği',
    },
  };
  const copy = replies[data.language];
  const message = alternative ? copy.proposal : copy[action];
  return { subject: copy.subject, body: `${copy.greeting}\n\n${message}\n\n${copy.closing}\nOranienstraße 168 · 10999 Berlin\n030 67392575\n\n${copy.zone}\n${copy.id}: ${data.requestId}` };
}

export function buildMailto(booking, draft) {
  const data = validate(booking);
  const subject = text(draft?.subject, 1, 200);
  if (typeof draft?.body !== 'string' || draft.body.length > 3500 || !draft.body.trim() ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(draft.body)) {
    throw new Error('Bitte prüfe deinen Antworttext (maximal 3.500 Zeichen).');
  }
  const body = draft.body.trim().replace(/\r\n|\r|\n/g, '\r\n');
  return `mailto:${encodeURIComponent(data.email).replace('%40', '@')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
