import { decodeReplyFragment, createReplyDraft, buildMailto, formatReplyDate } from './reservation-reply.js?v=20261021-reply-1';

const get = id => document.getElementById(id);
const languageNames = { de: 'Deutsch', en: 'Englisch', tr: 'Türkisch' };
let booking;
let action;

function updateMailLink() {
  const link = get('open-mail');
  get('mail-status').hidden = true;
  try {
    link.href = buildMailto(booking, { subject: get('reply-subject').value, body: get('reply-body').value });
    link.setAttribute('aria-disabled', 'false');
    link.tabIndex = 0;
    get('copy-reply').disabled = false;
    get('draft-error').hidden = true;
  } catch (error) {
    link.removeAttribute('href');
    link.setAttribute('aria-disabled', 'true');
    link.tabIndex = -1;
    get('copy-reply').disabled = true;
    get('draft-error').textContent = error.message;
    get('draft-error').hidden = false;
  }
}

function updateDraft() {
  const section = get('draft-section');
  section.hidden = false;
  try {
    const draft = createReplyDraft(booking, action, {
      date: get('alternative-date').value, time: get('alternative-time').value,
      question: get('question').value,
    });
    get('reply-subject').value = draft.subject;
    get('reply-body').value = draft.body;
    get('reply-body').lang = booking.language;
    get('draft-notice').textContent = `Entwurf auf ${languageNames[booking.language]}. Du kannst Betreff und Nachricht vor dem Öffnen ändern.`;
    updateMailLink();
  } catch (error) {
    // Clear the previous action, so incomplete questions cannot send an older acceptance.
    get('reply-subject').value = '';
    get('reply-body').value = '';
    get('draft-notice').textContent = error.message;
    updateMailLink();
    get('draft-error').hidden = true;
  }
}

function loadBooking() {
  booking = undefined;
  action = undefined;
  get('reply-workspace').hidden = true;
  get('reply-error').hidden = true;
  ['draft-section', 'custom-slot', 'question-field', 'mail-status', 'draft-error'].forEach(id => { get(id).hidden = true; });
  ['reply-subject', 'reply-body', 'question'].forEach(id => { get(id).value = ''; });
  get('open-mail').removeAttribute('href');
  get('open-mail').setAttribute('aria-disabled', 'true');
  get('open-mail').tabIndex = -1;
  get('copy-reply').disabled = true;
  document.querySelectorAll('[data-action]').forEach(button => button.setAttribute('aria-pressed', 'false'));
  try {
    booking = decodeReplyFragment(location.hash);
    // The payload remains in memory only; reload requires opening the original mail link.
    history.replaceState(null, '', location.pathname);
    get('guest-name').textContent = booking.name;
    get('guest-email').textContent = booking.email;
    get('guest-slot').textContent = `${formatReplyDate(booking.date)}, ${booking.time} Uhr`;
    get('guest-count').textContent = booking.guests;
    get('guest-language').textContent = languageNames[booking.language];
    get('question-language').textContent = `(${languageNames[booking.language]})`;
    get('alternative-date').value = booking.date;
    get('alternative-time').value = booking.time;
    get('question').lang = booking.language;
    get('reply-workspace').hidden = false;
  } catch (error) {
    get('reply-error').textContent = error.message;
    get('reply-error').hidden = false;
  }
}
loadBooking();
// A mail app may reuse this tab for another request without a full page load.
window.addEventListener('hashchange', () => {
  if (location.hash !== '#reply-main') loadBooking();
});

document.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => {
  action = button.dataset.action;
  document.querySelectorAll('[data-action]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  get('custom-slot').hidden = action !== 'custom';
  get('question-field').hidden = action !== 'question';
  updateDraft();
  if (action === 'question') get('question').focus();
  else if (action === 'custom') get('alternative-date').focus();
}));

['alternative-date', 'alternative-time', 'question'].forEach(id => get(id).addEventListener('input', updateDraft));
['reply-subject', 'reply-body'].forEach(id => get(id).addEventListener('input', updateMailLink));
get('open-mail').addEventListener('click', event => {
  if (event.currentTarget.getAttribute('aria-disabled') === 'true') { event.preventDefault(); return; }
  get('mail-status').textContent = 'Bitte im Mailprogramm prüfen und selbst absenden. Falls sich nichts öffnet, antworte direkt auf die Originalmail und kopiere den Entwurf.';
  get('mail-status').hidden = false;
});
get('copy-reply').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(get('reply-body').value);
    get('mail-status').textContent = 'Antworttext kopiert. Du kannst ihn direkt als Antwort auf die Originalmail einfügen und dort absenden.';
  } catch {
    get('reply-body').focus();
    get('reply-body').select();
    get('mail-status').textContent = 'Bitte den markierten Antworttext selbst kopieren und in die Antwort auf die Originalmail einfügen.';
  }
  get('mail-status').hidden = false;
});
