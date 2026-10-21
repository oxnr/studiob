import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createReplyLink } from '../reservation-reply.js';

test('reply controller clears old drafts for incomplete input and a second request in a reused tab', async t => {
  const html = await readFile(new URL('../reply.html', import.meta.url), 'utf8');
  function node() {
    return { value: '', textContent: '', hidden: false, disabled: false, attrs: {}, events: {},
      setAttribute(key, value) { this.attrs[key] = value; },
      getAttribute(key) { return this.attrs[key]; },
      removeAttribute(key) { delete this.attrs[key]; if (key === 'href') delete this.href; },
      addEventListener(type, callback) { this.events[type] = callback; }, focus() {}, select() {} };
  }
  const nodes = new Map([...html.matchAll(/id="([^"]+)"/g)].map(match => [match[1], node()]));
  const actions = [...html.matchAll(/data-action="([^"]+)"/g)].map(match => ({ ...node(), dataset: { action: match[1] } }));
  const booking = { name: 'First Guest', email: 'first@example.invalid', date: '2026-10-23', time: '19:00',
    guests: 2, language: 'de', requestId: '550e8400-e29b-41d4-a716-446655440000' };
  const page = { hash: new URL(createReplyLink(booking)).hash, pathname: '/reply.html' };
  const pageEvents = {};
  const originals = new Map(['document', 'window', 'location', 'history'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries({
    document: { getElementById: id => nodes.get(id), querySelectorAll: () => actions },
    window: { addEventListener: (type, callback) => { pageEvents[type] = callback; } },
    location: page, history: { replaceState: () => { page.hash = ''; } },
  })) Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  t.after(() => {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  await import('../reply.js');
  const get = id => nodes.get(id);
  const click = action => actions.find(button => button.dataset.action === action).events.click();
  assert.equal(page.hash, '');
  assert.equal(get('guest-name').textContent, 'First Guest');
  click('accept');
  assert.match(get('open-mail').href, /^mailto:first@/);
  get('reply-body').value = 'Persönlich geänderter Text';
  get('reply-body').events.input();
  assert.equal(new URL(get('open-mail').href).searchParams.get('body'), 'Persönlich geänderter Text');
  page.hash = '#reply-main';
  pageEvents.hashchange();
  assert.equal(get('guest-name').textContent, 'First Guest');
  assert.equal(get('reply-workspace').hidden, false);
  assert.equal(new URL(get('open-mail').href).searchParams.get('body'), 'Persönlich geänderter Text');

  click('question');
  assert.equal(get('reply-body').value, '');
  assert.equal(get('reply-subject').value, '');
  assert.equal(get('open-mail').href, undefined);
  assert.equal(get('copy-reply').disabled, true);
  get('question').value = 'Sind Kinder dabei?';
  get('question').events.input();
  assert.match(new URL(get('open-mail').href).searchParams.get('body'), /Sind Kinder dabei/);

  click('custom');
  get('alternative-time').value = '';
  get('alternative-time').events.input();
  assert.equal(get('open-mail').href, undefined);
  assert.equal(get('reply-body').value, '');

  page.hash = new URL(createReplyLink({ ...booking, name: 'Second Guest', email: 'second@example.invalid', language: 'en' })).hash;
  pageEvents.hashchange();
  assert.equal(page.hash, '');
  assert.equal(get('guest-name').textContent, 'Second Guest');
  assert.equal(get('draft-section').hidden, true);
  assert.equal(get('question').value, '');
  assert.equal(get('open-mail').href, undefined);
  click('reject');
  assert.match(get('open-mail').href, /^mailto:second@/);
  assert.match(get('reply-body').value, /cannot offer a table/);
  assert.ok(!get('reply-body').value.includes('First Guest'));

  page.hash = '#broken';
  pageEvents.hashchange();
  assert.equal(get('reply-workspace').hidden, true);
  assert.equal(get('reply-error').hidden, false);
  assert.equal(get('open-mail').href, undefined);
});
