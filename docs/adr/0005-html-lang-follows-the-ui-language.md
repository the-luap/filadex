---
status: accepted
date: 2026-09-06
---

# The `<html lang>` attribute follows the active UI language

`client/index.html` hard-codes `<html lang="de">`, and nothing ever changed it.
The document language was therefore always `de`, whatever the user had selected
— wrong for English from the day the selector existed, and more visibly wrong
once Polish was added. Assistive technology, `:lang()` CSS, translation
prompts and search crawlers all read that attribute.

The fix has two halves, because neither covers the other's case:

- The client owns the attribute once the SPA is running: only client JS can
  react to a language switch that does not reload the page.
- The server owns the *first* value: the attribute has to be right in the HTML
  before any script runs, for no-JS clients, crawlers, and to avoid a flash.

## Decisions

### The client keeps `document.documentElement.lang` in sync

`LanguageProvider` resolves the active language synchronously at mount via
`getInitialClientLanguage()` and then in `useEffect` once user settings load,
following the precedence:
1. a language chosen before the session existed, which the account has not heard
   about yet (see below)
2. User settings from API (if logged in)
3. `localStorage` (explicit client-side choice)
4. `language` cookie
5. `document.documentElement.lang` (server-rendered initial shell)
6. browser languages (`navigator.languages`, first supported entry wins)
7. `VITE_DEFAULT_LANGUAGE`
8. English fallback (`en`)

The server's stamp sits above the browser list because it is the only source
that has seen the logged-in user's stored preference. Ranking it below meant a
user whose account says `pl`, arriving on a fresh profile whose browser asks for
`de`, was dragged to German — permanently on `/public/*` routes, where the
account is never fetched.

It writes the active language to the DOM and cookie:

```tsx
useEffect(() => {
  document.documentElement.lang = language;
  document.cookie = `language=${language};path=/;max-age=31536000;samesite=lax`;
}, [language]);
```

This runs on the initial resolved language and on every subsequent switch.

### A language chosen before login is pushed to the account after login

The selector now renders on the pre-login screens, where there is no account to
write to: `setLanguage` can only reach `localStorage` and the cookie. The next
render undid that — `/api/auth/me` returned the account's stored `language`
(`en` by schema default) and the effect overwrote the fresh choice with it.

`LanguageProvider` holds a choice made with no session and flushes it to
`POST /api/users/language` the first time account data appears, so the language
the visitor picked to read the login form in is the one their new session keeps.

That pending choice lives in `sessionStorage`, not a `useRef` or a module
variable. Both of the simpler options were tried and both lose it:

- A ref dies on the remount `AuthProvider` forces. It renders a loading
  placeholder instead of its children while it re-checks the session, and does
  so on every route change, so `/login` → `/` unmounts `LanguageProvider`.
- A module variable survives that but not a page load, and reloading before
  logging in is ordinary — a failed first attempt, a password manager, a mailed
  link opened in a fresh tab. The cookie and the stamp do restore the *display*
  across a reload, but the `[account]` effect still prefers the account's stored
  language over both, so a choice that does not survive here is never written to
  the account at all.

`sessionStorage` has the lifetime this actually wants: it outlives a reload, is
scoped to the one tab, and is gone when the tab is. Reads and writes are wrapped
in `try`/`catch`; a browser that refuses session storage loses only the deferred
write, since the choice still applies to the tab via `localStorage` and the
cookie. `tests/e2e/login-language.spec.ts` is what caught each of these; it
fails against the ref and, with the reload in it, against the module variable.

Conversely, a pick made *on* those screens while some other session is still
cached in the browser stays device-local: `LanguageProvider` treats every route
in `PUBLIC_ROUTES` as having no account context, so the selector there never
rewrites a signed-in user's stored preference.

### The client writes a `language` cookie for the server to read

The server cannot see `localStorage`, which is the client's resolution source
when an unauthenticated user selects a language. Mirroring the active
language into a plain (non-`httpOnly`) cookie is what lets the server render the
same value the SPA will settle on, from the second page load onward. The cookie
is set from the same effect, so it always reflects the language actually in use.

### The server stamps `<html lang>` on the way out

`server/utils/resolve-language.ts` exposes `resolveLanguage(req)`, which mirrors
the client's order as closely as the server can:

1. the logged-in user's stored preference — the JWT `token` cookie is decoded
   via the `verifyToken` export in `server/auth.ts`, then `storage.getUser(id).language`
2. a supported `language` cookie
3. the `Accept-Language` header, first supported tag wins
4. `en`

Step 1 is skipped unless the request is a `GET` that accepts HTML. Both SPA
catch-alls run for every method and every unmatched path, so without that guard
a mistyped API path or an asset probe cost a JWT verify plus a full user-row
read to pick between three two-letter strings.

Steps 2–4 are also exported on their own as `resolveAnonymousLanguage(req)`,
which is what `POST /api/auth/register` and the account-recovery mails use.
`/register` is an unguarded route: a user with a session can open it and create
a second account, and the new account's language must come from the request,
not from whoever the `token` cookie belongs to.

The module also exposes `setHtmlLang(html, lang)`, a single-line regex replace
of the one `<html lang="…">` tag.

Both serving paths in `server/vite.ts` apply it:

- **dev**: after `vite.transformIndexHtml`.
- **prod**: `express.static` is now mounted with `{ index: false }` so a request
  for `/` falls through to the catch-all instead of being served the raw file.
  `{ index: false }` only covers directory requests, so `/index.html` is routed
  to the same handler explicitly. The handler reads `index.html` per request and
  rewrites the attribute, forwarding any unexpected rejection to `next(e)`.

Both paths send the shell with `Vary: Cookie, Accept-Language` and
`Cache-Control: no-cache`, via `res.send` so Express still computes an ETag and
answers `If-None-Match` with a 304. The response now depends on the request's
cookies and headers; without `Vary`, a proxy or CDN that caches `text/html`
would serve the first visitor's `lang="pl"` to everyone.

`client/index.html`'s static default changed from `de` to `en` to match
`LanguageProvider`'s fallback default.

### Rejected: full server-side rendering of the app

The app is a plain SPA; `transformIndexHtml` is the only "SSR" in play. Standing
up React SSR to get one attribute right is not worth it. A targeted string
replace on the shell is enough.

### Rejected: decoding the JWT inside `resolve-language.ts`

`JWT_SECRET` is module-private in `server/auth.ts`. Exposing a small
`verifyToken(token) → userId | null` keeps the secret and the `jwt` dependency
in one file; `authenticate` is left untouched.

## Consequences

- There is still a one-render flash for a brand-new visitor with no cookie whose
  `localStorage` resolves to something other than the `Accept-Language` guess.
  The client effect corrects it on mount, and the cookie makes every later load
  exact. This is strictly better than the previous always-`de`.
- The production catch-all now returns `index.html` with a 200 for unknown asset
  paths — same status as the previous `res.sendFile`, so no change there.
- Supported languages (`en`, `de`, `pl`) are centralized in `shared/languages.ts`
  and imported across client and server to prevent drift.
- The client scans `navigator.languages` the way the server scans
  `Accept-Language`, so both reach the same answer for a visitor whose first
  choice is unsupported but whose second is. Reading only `navigator.language`
  made the client give up at the first entry and fall to
  `VITE_DEFAULT_LANGUAGE`, disagreeing with the stamp the server had just sent.
- The logged-in branch adds one `getUser` query per HTML document request when
  a JWT session token is present. Unauthenticated requests, non-`GET` requests
  and requests that do not accept HTML skip the database query and resolve from
  the `language` cookie or `Accept-Language`.
- `VITE_DEFAULT_LANGUAGE` is now effectively unreachable wherever the app is
  served by its own server, because the stamp always carries a supported value
  and outranks it. It still applies if the built client is served by something
  that does not stamp the tag. This is a behaviour change for self-built
  deployments that set it — a build with `VITE_DEFAULT_LANGUAGE=de` used to show
  German to an `en-US` browser and no longer does — and is called out in the
  README. Docker images never had a build arg for it, so they are unaffected.
- `DEFAULT_LANGUAGE` is gone from the compose files and the docs. It was never
  read by any server code, and this ADR is why it can't be revived as-is: the
  language of the initial HTML now comes from `resolveLanguage(req)`, and a new
  user's stored language is whatever `resolveAnonymousLanguage(req)` resolved at
  registration. A server-side default would have to insert itself into that
  order, ahead of `Accept-Language` but behind the cookie, and it is not clear
  that an operator-set default should outrank the visitor's own browser.

## Tests

- `tests/utils/resolve-language.test.ts` covers user preference precedence over
  cookies, cookie fallback, `Accept-Language` header parsing, `en` default, and `setHtmlLang`.
- `tests/i18n/resolve-client-language.test.ts` covers client resolution order:
  `localStorage` → `cookie` → `documentLang` → `browserLanguages` → `defaultLanguage` → `en`,
  plus `getBrowserLanguages`, `getLanguageCookie` (including a cookie value that
  is not valid percent-encoding) and `getStorageLanguage` against a stubbed browser global.
- `tests/server/serve-static.test.ts` covers the production catch-all serving stamped HTML,
  the explicit `/index.html` path, the cache headers and 304 revalidation, and
  forwarding errors to `next()` on rejection.
- `tests/routes/auth.test.ts` pins that registering while another account's
  session cookie is present does not inherit that account's language.
- `tests/utils/email-templates.test.ts` covers every supported language and the
  escaping of user-supplied filament names, entity labels and review notes.
- `tests/e2e/register-language.spec.ts` drives the real bundle in a browser:
  signing in as the seeded `bob` (stored `language: "de"`), opening `/register`
  with that session live, choosing Polish, and registering. It asserts through
  the admin user list that the new account is `pl` - not `de` inherited from the
  session - and that `bob` is still `de`, so the selector on an auth screen did
  not rewrite the signed-in account. Both assertions fail against the code
  before this change, each against its own half of the fix.
- `tests/e2e/login-language.spec.ts` drives the real bundle in a browser:
  choosing Polish on `/login`, reloading, signing in as the seeded `alice`
  (stored `language: "en"`), and asserting both that the account ends up on `pl`
  and that `<html lang>` survives a further reload. The reload before login is
  deliberate — it is what distinguishes a choice that reaches the account from
  one that only looks like it did. The ordering of two React effects against a
  real session query is not observable in the `renderToString` component tests,
  which run no effects at all.
