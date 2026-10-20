import { translations } from './translations.js?v=20261020-native-2';
import { submitReservation } from './formsubmit-service.js?v=20261020-native-2';

const form = document.querySelector('#reservation-form');
const status = document.querySelector('#form-status');
const submitButton = form.querySelector('[type="submit"]');
const config = window.STUDIO_B_CONFIG || {};
const preview = location.origin !== 'https://studiob.bar';
const formEnabled = preview || (config.reservationEnabled === true && !!config.reservationEndpoint);
const languages = ['de', 'en', 'tr'];
const requestedLanguage = new URL(location.href).searchParams.get('lang');
let language = languages.includes(requestedLanguage) ? requestedLanguage : 'de';
let submitting = false;
let completed = false;
let lastPayload = '';
let requestId = '';

function t(key) { return translations[language][key] || translations.de[key] || key; }

function setLanguage(lang) {
  language = lang;
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach(element => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
    element.placeholder = t(element.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('[data-lang]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.lang === lang));
  });
  for (const [name, key] of [['guests','guestsLabel'],['date','dateLabel'],['time','timeLabel']]) {
    form.elements[name].setAttribute('aria-label', t(key));
  }
  if (submitting) submitButton.querySelector('[data-i18n]').textContent = t('sending');
  else if (completed) submitButton.querySelector('[data-i18n]').textContent = t('sentShort');
  const url = new URL(location.href);
  if (lang === 'de') url.searchParams.delete('lang');
  else url.searchParams.set('lang', lang);
  history.replaceState(null, '', url);
}

document.querySelectorAll('[data-lang]').forEach(button => {
  button.addEventListener('click', () => setLanguage(button.dataset.lang));
});

const menuButton = document.querySelector('.menu-toggle');
const mobileNav = document.querySelector('#mobile-nav');
function closeMenu() {
  mobileNav.hidden = true;
  menuButton.setAttribute('aria-expanded', 'false');
}
menuButton.addEventListener('click', () => {
  mobileNav.hidden = !mobileNav.hidden;
  menuButton.setAttribute('aria-expanded', String(!mobileNav.hidden));
});
mobileNav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !mobileNav.hidden) { closeMenu(); menuButton.focus(); }
});

function berlinDateTime() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone:'Europe/Berlin', year:'numeric', month:'2-digit', day:'2-digit',
    hour:'2-digit', minute:'2-digit', hourCycle:'h23'
  }).formatToParts(new Date());
  const p = Object.fromEntries(parts.map(part => [part.type,part.value]));
  return { date:`${p.year}-${p.month}-${p.day}`, time:`${p.hour}:${p.minute}` };
}
const today = berlinDateTime().date;
form.elements.date.min = today;
const maxDate = new Date(`${today}T12:00:00Z`);
maxDate.setUTCDate(maxDate.getUTCDate() + 180);
form.elements.date.max = maxDate.toISOString().slice(0, 10);
for (let minutes = 9 * 60; minutes <= 23 * 60 + 30; minutes += 30) {
  const time = `${Math.floor(minutes / 60)}`.padStart(2, '0') + ':' + `${minutes % 60}`.padStart(2, '0');
  form.elements.time.add(new Option(time,time));
}
function updateSlots() {
  const now = berlinDateTime();
  form.elements.date.min = now.date;
  for (const option of form.elements.time.options) {
    option.disabled = !!option.value && form.elements.date.value === now.date && option.value <= now.time;
  }
  if (form.elements.time.selectedOptions[0]?.disabled) form.elements.time.value = '';
}
form.elements.date.addEventListener('change', updateSlots);
form.elements.time.addEventListener('focus', updateSlots);

function showStatus(message, error = false) {
  status.hidden = false;
  status.textContent = message;
  status.classList.toggle('error', error);
  status.focus({preventScroll:true});
  status.scrollIntoView({block:'nearest',behavior:'smooth'});
}

document.querySelector('#preview-note').hidden = !preview;
document.querySelector('#reservation-unavailable').hidden = formEnabled;

form.addEventListener('input', () => {
  if (!submitting && !completed) status.hidden = true;
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!formEnabled || submitting || completed) return;
  updateSlots();
  if (!form.reportValidity()) return;
  const values = Object.fromEntries(new FormData(form));
  values.name = values.name.trim();
  values.email = values.email.trim();
  values.phone = values.phone.trim();
  values.note = values.note.trim();
  values.language = language;
  if (values.name.length < 2) return showStatus(t('invalidName'),true);
  if (!/^\+?[\d\s().-]{7,30}$/.test(values.phone) || !/^\d{7,15}$/.test(values.phone.replace(/\D/g,''))) return showStatus(t('invalidPhone'),true);

  const payload = JSON.stringify(values);
  if (lastPayload !== payload || !requestId) {
    requestId = crypto.randomUUID();
    lastPayload = payload;
  }
  values.requestId = requestId;
  delete values.privacy;
  submitting = true;
  submitButton.disabled = true;
  submitButton.querySelector('[data-i18n]').textContent = t('sending');
  status.hidden = true;
  try {
    const result = await submitReservation(values);
    if (result.preview) {
      showStatus(t('previewSuccess'));
    } else if (result.success === true) {
      completed = true;
      showStatus(result.message || t('sent'));
      form.querySelectorAll('input, select, textarea').forEach(input => { input.disabled = true; });
      // No analytics event is emitted without a separately approved measurement setup.
    } else {
      showStatus(t('networkError'),true);
    }
  } catch (error) {
    const message = error.deliveryUnknown ? t('retryWarning') : (error.message || t('networkError'));
    showStatus(message,true);
  } finally {
    submitting = false;
    submitButton.disabled = completed;
    submitButton.querySelector('[data-i18n]').textContent = completed ? t('sentShort') : t('submit');
  }
});

if ('IntersectionObserver' in window) {
  const book = document.querySelector('.mobile-book');
  new IntersectionObserver(entries => {
    book.classList.toggle('is-hidden',entries[0].isIntersecting);
  }, {threshold:0.08}).observe(document.querySelector('#reservieren'));
}
document.querySelector('#year').textContent = new Date().getFullYear();
setLanguage(language);
submitButton.disabled = !formEnabled;
if (!formEnabled) form.querySelectorAll('input, select, textarea').forEach(input => { input.disabled = true; });
