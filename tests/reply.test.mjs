import assert from 'node:assert/strict';
import test from 'node:test';
import { createReplyLink, decodeReplyFragment, shiftReservationSlot, createReplyDraft, buildMailto } from '../reservation-reply.js';

const booking = Object.freeze({
  v: 1, name: 'Çağla Müller', email: 'guest+test@example.invalid', date: '2026-10-23',
  time: '19:00', guests: 4, language: 'de', requestId: '550e8400-e29b-41d4-a716-446655440000',
});
const fragment = data => `#v1=${Buffer.from(JSON.stringify(data)).toString('base64url')}`;

test('private reply URL round-trips Unicode while keeping notes, phone and extra recipients out', () => {
  const url = new URL(createReplyLink({ ...booking, phone: '+49301234567', note: 'Private health detail', _cc: 'other@example.invalid' }));
  assert.equal(url.origin + url.pathname, 'https://studiob.bar/reply.html');
  assert.equal(url.search, '');
  assert.deepEqual(decodeReplyFragment(url.hash), booking);
  assert.equal(Object.isFrozen(decodeReplyFragment(url.hash)), true);
  assert.equal(decodeReplyFragment(url.hash).phone, undefined);
  assert.equal(decodeReplyFragment(url.hash).note, undefined);
});

test('malformed fragments, unexpected fields, invalid calendar dates and unsupported versions fail closed', () => {
  for (const value of ['', '#', '#v2=AAAA', '#v1=%7B%7D', '#v1=AAAA&cc=other', '#v1=' + 'A'.repeat(2401),
    '#v1=_w', fragment(null), fragment([]), fragment({ ...booking, v: 2 }),
    fragment({ ...booking, date: '2026-02-29' }), fragment({ ...booking, date: '2026-13-01' }),
    fragment({ ...booking, date: '2026-10-23T10:00:00Z' }), fragment({ ...booking, time: '24:00' }),
    fragment({ ...booking, time: '19:15' }), fragment({ ...booking, time: '9:00' }),
    fragment({ ...booking, guests: 0 }), fragment({ ...booking, guests: 21 }),
    fragment({ ...booking, guests: '4' }), fragment({ ...booking, requestId: 'not-an-id' }),
    fragment({ ...booking, language: 'fr' }), fragment({ ...booking, cc: 'other@example.invalid' }),
  ]) assert.throws(() => decodeReplyFragment(value));
});

test('header injection and multiple email recipients are rejected before a mailto can exist', () => {
  for (const email of ['guest@example.invalid\r\nBcc: other@example.invalid',
    'guest@example.invalid,other@example.invalid', 'guest@example.invalid;other@example.invalid',
    'guest%0d%0aBcc=other@example.invalid', 'Guest <guest@example.invalid>', 'guest@example.invalid?cc=other@example.invalid']) {
    assert.throws(() => createReplyLink({ ...booking, email }));
  }
  assert.throws(() => createReplyLink({ ...booking, name: 'Guest\nBcc: other@example.invalid' }));
  assert.throws(() => createReplyLink({ ...booking, name: 'x'.repeat(101) }));
  assert.throws(() => buildMailto(booking, { subject: 'Hello\r\nBcc: other@example.invalid', body: 'Hi' }));
});

test('30-minute shifts handle midnight, leap days and year rollover as Berlin civil times', () => {
  assert.deepEqual(shiftReservationSlot({ ...booking, date: '2026-12-31', time: '23:30' }, 30), { date: '2027-01-01', time: '00:00' });
  assert.deepEqual(shiftReservationSlot({ ...booking, date: '2027-01-01', time: '00:00' }, -30), { date: '2026-12-31', time: '23:30' });
  assert.deepEqual(shiftReservationSlot({ ...booking, date: '2028-03-01', time: '00:00' }, -30), { date: '2028-02-29', time: '23:30' });
  assert.deepEqual(shiftReservationSlot({ ...booking, date: '2026-03-29', time: '09:00' }, -30), { date: '2026-03-29', time: '08:30' });
  assert.throws(() => shiftReservationSlot(booking, 60));
});

test('acceptance includes exactly the requested slot, party size and request identity in every guest language', () => {
  for (const language of ['de', 'en', 'tr']) {
    const draft = createReplyDraft({ ...booking, language }, 'accept');
    assert.match(draft.subject, /2026-10-23 19:00/);
    assert.ok(draft.body.includes('Çağla Müller'));
    assert.ok(draft.body.includes('4'));
    assert.ok(draft.body.includes('19:00'));
    assert.ok(draft.body.includes(booking.requestId));
    assert.ok(draft.body.includes('Berlin'));
    assert.ok(!draft.body.includes('undefined'));
  }
  assert.match(createReplyDraft(booking, 'accept').body, /bestätigen/);
  assert.match(createReplyDraft({ ...booking, language: 'en' }, 'accept').body, /is confirmed/);
  assert.match(createReplyDraft({ ...booking, language: 'tr' }, 'accept').body, /onaylıyoruz/);
});

test('alternatives include the changed date and time and remain explicitly unconfirmed proposals', () => {
  const late = { ...booking, date: '2026-12-31', time: '23:30' };
  const draft = createReplyDraft(late, 'later');
  assert.match(draft.body, /1\. Januar 2027/);
  assert.match(draft.body, /00:00/);
  assert.match(draft.body, /noch nicht bestätigt/);
  assert.match(createReplyDraft(booking, 'earlier').body, /18:30/);
  assert.match(createReplyDraft({ ...booking, language: 'en' }, 'custom', { date: '2026-10-24', time: '20:00' }).body, /24 October 2026 at 20:00/);
  assert.match(createReplyDraft({ ...booking, language: 'en' }, 'later').body, /not confirmed yet/);
  assert.match(createReplyDraft({ ...booking, language: 'tr' }, 'later').body, /henüz onaylanmamıştır/);
  assert.throws(() => createReplyDraft(booking, 'custom', { date: '2026-02-30', time: '20:00' }));
  assert.throws(() => createReplyDraft(booking, 'custom', { date: booking.date, time: '' }));
});

test('questions require real text and never inherit an acceptance or a previously proposed time', () => {
  const accepted = createReplyDraft(booking, 'accept');
  for (const question of ['', '  \n', 'x'.repeat(1501), 'Hi\u0000there']) {
    assert.throws(() => createReplyDraft(booking, 'question', { question }));
  }
  const asked = createReplyDraft(booking, 'question', { question: 'Sind Kinder dabei?\nBraucht ihr einen Hochstuhl?' });
  assert.match(asked.body, /Sind Kinder dabei\?\nBraucht ihr einen Hochstuhl\?/);
  assert.match(asked.body, /noch nicht bestätigt/);
  assert.notEqual(asked.body, accepted.body);
  createReplyDraft(booking, 'later');
  const rejected = createReplyDraft(booking, 'reject');
  assert.match(rejected.body, /keinen Tisch anbieten/);
  assert.ok(!rejected.body.includes('19:30'));
  assert.throws(() => createReplyDraft(booking, 'send'));
});

test('mailto contains one guest, edited text and only the intended subject/body query parameters', () => {
  const draft = { subject: 'Studio B · Rückfrage & ein Vorschlag?', body: 'Hallo Çağla,\nIst 19:30 okay?\nText: &bcc=other@example.invalid' };
  const url = new URL(buildMailto(booking, draft));
  assert.equal(url.protocol, 'mailto:');
  assert.equal(decodeURIComponent(url.pathname), booking.email);
  assert.deepEqual([...url.searchParams.keys()], ['subject', 'body']);
  assert.equal(url.searchParams.get('subject'), draft.subject);
  assert.equal(url.searchParams.get('body'), draft.body.replaceAll('\n', '\r\n'));
  assert.equal(url.searchParams.get('bcc'), null);
  assert.throws(() => buildMailto(booking, { subject: '', body: 'Hi' }));
  assert.throws(() => buildMailto(booking, { subject: 'Hi', body: '' }));
  assert.throws(() => buildMailto(booking, { subject: 'Hi', body: 'x'.repeat(3501) }));
});
