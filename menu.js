import { translations } from './translations.js?v=20261021-reply-1';

const languages = ['de','en','tr'];
const requestedLanguage = new URL(location.href).searchParams.get('lang');

function setLanguage(language) {
  document.documentElement.lang = language;
  document.querySelectorAll('[data-i18n]').forEach(element => {
    element.textContent = translations[language][element.dataset.i18n];
  });
  document.querySelectorAll('[data-i18n-alt]').forEach(element => {
    element.alt = translations[language][element.dataset.i18nAlt];
  });
  document.querySelectorAll('[data-lang]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.lang === language));
  });
  document.querySelectorAll('.home-reserve, .menu-home, .logo, footer>a').forEach(link => {
    const target = new URL(link.href);
    if (language === 'de') target.searchParams.delete('lang');
    else target.searchParams.set('lang', language);
    link.href = target;
  });
  const url = new URL(location.href);
  if (language === 'de') url.searchParams.delete('lang');
  else url.searchParams.set('lang', language);
  history.replaceState(null, '', url);
}

function showMenu() {
  const hash = location.hash.slice(1);
  const target = document.getElementById(hash);
  const group = target?.closest('.menu-panel')?.id || document.querySelector('[data-menu-group][aria-current]')?.dataset.menuGroup || 'speisen';
  document.querySelectorAll('.menu-panel').forEach(panel => {
    panel.hidden = panel.id !== group;
  });
  document.querySelectorAll('[data-menu-group]').forEach(link => {
    if (link.dataset.menuGroup === group) link.setAttribute('aria-current', 'true');
    else link.removeAttribute('aria-current');
  });
  if (target?.matches('.menu-category')) target.open = true;
  if (target?.matches('.menu-panel, .menu-category')) target.scrollIntoView({block:'start'});
}

document.querySelectorAll('[data-lang]').forEach(button => {
  button.addEventListener('click', () => setLanguage(button.dataset.lang));
});
window.addEventListener('hashchange', showMenu);
setLanguage(languages.includes(requestedLanguage) ? requestedLanguage : 'de');
showMenu();
