# Secure editor session migration

This branch introduces a replacement authentication foundation without changing the production client yet.

## Added endpoints

- `POST /api/editor/login`
- `GET /api/editor/session`
- `POST /api/editor/logout`
- `POST /api/editor/content`

The new flow uses a short-lived signed `HttpOnly`, `Secure`, `SameSite=Strict` cookie. State-changing requests also require a CSRF token and same-origin validation.

## Required Netlify environment variables

- `EDITOR_PASSWORD_HASH`: exactly 64 lowercase hexadecimal characters containing the SHA-256 digest of the editor password.
- `SESSION_SECRET`: at least 32 high-entropy characters; 64 random characters are recommended.
- `PUBLIC_SITE_ORIGIN`: `https://askeriterimlersozlugu.com`

Plaintext `EDITOR_PASSWORD` and `ATS_EDITOR_PASSWORD` must be removed after migration.

## Deliberate compatibility state

The existing browser client still uses the legacy `/api/content` hash credential. Therefore this branch is not ready to merge by itself. The next commit must migrate `index.html` to:

1. submit the password only to `/api/editor/login`;
2. use `credentials: "same-origin"`;
3. keep only the CSRF token in memory, not in `localStorage` or `sessionStorage`;
4. check `/api/editor/session` on page load;
5. write only through `/api/editor/content` with `X-CSRF-Token`;
6. call `/api/editor/logout` when locking the editor;
7. remove `sha256Hex`, `sozlukEditorHash`, `sozlukEditorPass`, and all `X-Editor-Password*` headers.

After preview testing succeeds, the legacy authentication path in `netlify/functions/content.js` and `_shared.js` must be removed, not merely left as a fallback.

## Mandatory validation

- correct password login;
- incorrect password and rate limit response;
- session restoration after refresh;
- expiration after 45 minutes;
- logout and cookie deletion;
- add, edit and delete a term;
- update Turkish and English page text;
- reject missing or incorrect CSRF token;
- reject a foreign `Origin` header;
- verify that JavaScript cannot read the session cookie;
- verify that public GET content remains available.
