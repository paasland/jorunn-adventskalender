// Kryptering av lukene (AES-GCM via WebCrypto). Brukes av både index.html og admin.html.
// Hver luke har sin egen nøkkel = HMAC-SHA256(hovedhemmelighet, "luke:" + n).
// Nøkkelen ligger kun i QR-koden (URL-fragmentet etter #), aldri i repoet og aldri hos serveren.
const Lock = (() => {
  const enc = new TextEncoder(), dec = new TextDecoder();
  const b64u = bytes => { let s = ''; bytes.forEach(b => s += String.fromCharCode(b)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

  const aesKey = keyStr => crypto.subtle.importKey('raw', unb64u(keyStr), 'AES-GCM', false, ['encrypt', 'decrypt']);

  return {
    newSecret: () => b64u(crypto.getRandomValues(new Uint8Array(24))),
    isEncrypted: v => !!v && typeof v === 'object' && typeof v.ct === 'string',

    // Nøkkel (base64url) for luke n
    async doorKey(master, n) {
      const k = await crypto.subtle.importKey('raw', enc.encode(master), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      return b64u(new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode('luke:' + n))));
    },
    async encrypt(text, keyStr) {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(keyStr), enc.encode(text));
      return { v: 1, iv: b64u(iv), ct: b64u(new Uint8Array(ct)) };
    },
    // Kaster feil ved feil nøkkel / endret data
    async decrypt(obj, keyStr) {
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64u(obj.iv) }, await aesKey(keyStr), unb64u(obj.ct));
      return dec.decode(pt);
    },
  };
})();
