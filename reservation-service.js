const messages = {
  de: {
    invalid_input: 'Bitte prüfe deine Reservierungsangaben.',
    past_slot: 'Bitte wähle einen Termin in der Zukunft.',
    date_too_far: 'Reservierungsanfragen sind bis zu 180 Tage im Voraus möglich.',
    challenge: 'Bitte bestätige den Spam-Schutz erneut.',
    unavailable: 'Die Anfrage kann gerade nicht gesendet werden. Bitte rufe Studio B an.',
    unknown: 'Der Versand konnte nicht bestätigt werden. Bitte rufe Studio B an, bevor du erneut anfragst.',
    accepted: 'Deine Anfrage wurde an den Versanddienst übergeben. Dein Tisch ist erst nach persönlicher Bestätigung durch Studio B reserviert.',
  },
  en: {
    invalid_input: 'Please check your reservation details.',
    past_slot: 'Please choose a future date and time.',
    date_too_far: 'Reservations can be requested up to 180 days ahead.',
    challenge: 'Please complete the spam check again.',
    unavailable: 'Your request cannot be sent right now. Please call Studio B.',
    unknown: 'We could not confirm that your request was sent. Please call Studio B before submitting again.',
    accepted: 'Your request was accepted by the mail service. Your table is reserved only after Studio B personally confirms it.',
  },
  tr: {
    invalid_input: 'Lütfen rezervasyon bilgilerinizi kontrol edin.',
    past_slot: 'Lütfen gelecekteki bir tarih ve saat seçin.',
    date_too_far: 'En fazla 180 gün sonrası için rezervasyon talebi gönderilebilir.',
    challenge: 'Lütfen spam kontrolünü yeniden tamamlayın.',
    unavailable: 'Talebiniz şu anda gönderilemiyor. Lütfen Studio B’yi arayın.',
    unknown: 'Talebinizin gönderildiği doğrulanamadı. Tekrar göndermeden önce lütfen Studio B’yi arayın.',
    accepted: 'Talebiniz e-posta hizmeti tarafından kabul edildi. Rezervasyonunuz ancak Studio B’nin kişisel onayından sonra kesinleşir.',
  },
};

function requestError(code, language, deliveryUnknown = false) {
  const copy = messages[language] || messages.de;
  const key = deliveryUnknown ? 'unknown'
    : code.startsWith('challenge_') ? 'challenge'
      : Object.hasOwn(copy, code) ? code : 'unavailable';
  return Object.assign(new Error(copy[key]), { code, deliveryUnknown });
}

/**
 * Keep values.requestId stable when retrying an unchanged request.
 * A fresh Turnstile token is required for every manual attempt.
 * No live submission occurs without endpoint configuration or off studiob.bar.
 */
export async function submitReservation(values) {
  const config = globalThis.window?.STUDIO_B_CONFIG || {};
  const endpoint = config.reservationEndpoint;
  if (!endpoint || globalThis.location?.origin !== 'https://studiob.bar') {
    return { preview: true };
  }
  const language = ['de', 'en', 'tr'].includes(values.language) ? values.language : 'de';
  let url;
  try {
    url = new URL(endpoint);
    if (url.protocol !== 'https:' || url.username || url.password || url.hash ||
        url.pathname !== '/reservations') throw new Error();
  } catch {
    throw requestError('configuration_missing', language);
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(values.requestId || '')) {
    throw requestError('invalid_input', language);
  }
  if (!values.turnstileToken) throw requestError('challenge_required', language);

  const payload = {};
  for (const key of ['guests', 'date', 'time', 'name', 'phone', 'email', 'note',
    'website', 'requestId', 'turnstileToken']) {
    payload[key] = values[key] ?? '';
  }
  payload.language = language;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  let response;
  let result;
  try {
    response = await fetch(url.href, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
  if (!response.ok || result?.success !== true || result.requestId !== values.requestId) {
    throw requestError(
      typeof result?.error === 'string' ? result.error : 'invalid_response',
      language,
      result?.deliveryUnknown === true || (response.ok && result?.success === true),
    );
  }
  return {
    preview: false,
    success: true,
    requestId: result.requestId,
    message: messages[language].accepted,
  };
}
