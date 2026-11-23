import test from 'node:test';
import assert from 'node:assert/strict';
import {sendDraft} from '../gmail-send.js';
const draft = 'mailto:test@example.invalid?subject=Zusage&body=Gr%C3%BC%C3%9Fe';
test('Gmail receives a UTF-8 confirmation for the guest through the Studio B account', async () => {
  await sendDraft(draft, 'test', async (url, options) => {
    assert.match(url, /users\/studio\.b\.bln@gmail\.com\/messages\/send$/);
    const mime = Buffer.from(JSON.parse(options.body).raw, 'base64url').toString();
    assert.match(mime, /To: test@example.invalid\r\n/);
    assert.equal(Buffer.from(mime.split('\r\n\r\n')[1], 'base64').toString(), 'Grüße');
    return Response.json({id:'test'});
  });
});
test('missing Gmail acknowledgement never reports success', async () => {
  await assert.rejects(sendDraft(draft, 'test', async () => Response.json({})), /nicht bestätigt/);
});
