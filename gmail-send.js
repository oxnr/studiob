const account = 'studio.b.bln@gmail.com';
const scope = 'https://www.googleapis.com/auth/gmail.send';

function base64(value) {
  return btoa(Array.from(new TextEncoder().encode(value), byte => String.fromCharCode(byte)).join(''));
}

// Accept only the validated single-recipient draft produced by buildMailto.
export async function sendDraft(mailto, token, send = fetch) {
  const url = new URL(mailto);
  const subject = url.searchParams.get('subject');
  const body = url.searchParams.get('body');
  const recipient = decodeURIComponent(url.pathname);
  if (url.protocol !== 'mailto:' || !/^[^\s@,;<>\r\n]+@[a-z0-9.-]+$/i.test(recipient) || !subject || !body) throw Error('Ungültiger Entwurf.');
  const raw = base64([
    'From: ' + account, 'To: ' + recipient, 'Subject: =?UTF-8?B?' + base64(subject) + '?=',
    'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '',
    base64(body).match(/.{1,76}/g).join('\r\n')
  ].join('\r\n')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const response = await send('https://gmail.googleapis.com/gmail/v1/users/' + account + '/messages/send', {
    method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw })
  });
  if (!response.ok || !(await response.json()).id) throw Error('Versand nicht bestätigt. Bitte in Gmail unter „Gesendet“ prüfen.');
}

export function authorize(clientId) {
  return new Promise((resolve, reject) => {
    const fail = () => reject(Error('Google-Anmeldung oder Versandfreigabe fehlgeschlagen.'));
    google.accounts.oauth2.initTokenClient({
      client_id: clientId, scope, login_hint: account, include_granted_scopes: false,
      callback: result => result.access_token ? resolve(result.access_token) : fail(), error_callback: fail
    }).requestAccessToken();
  });
}
