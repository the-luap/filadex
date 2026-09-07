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
1. User settings from API (if logged in)
2. `localStorage` (explicit client-side choice)
3. `language` cookie
4. browser language (`navigator.language`)
5. `VITE_DEFAULT_LANGUAGE`
6. `document.documentElement.lang` (server-rendered initial shell)
7. English fallback (`en`)

It writes the active language to the DOM and cookie:

```tsx
useEffect(() => {
  document.documentElement.lang = language;
  document.cookie = `language=${language};path=/;max-age=31536000;samesite=lax`;
}, [language]);
```

This runs on the initial resolved language and on every subsequent switch.

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

and `setHtmlLang(html, lang)`, a single-line regex replace of the one
`<html lang="…">` tag.

Both serving paths in `server/vite.ts` apply it:

- **dev**: after `vite.transformIndexHtml`.
- **prod**: `express.static` is now mounted with `{ index: false }` so a request
  for `/` falls through to the catch-all instead of being served the raw file;
  the catch-all holds `index.html` in memory and rewrites the attribute per
  request, forwarding any unexpected rejection to Express `next(e)`.

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
- The logged-in branch adds one `getUser` query per HTML document request when
  a JWT session token is present. Unauthenticated requests skip the database query
  and resolve from the `language` cookie or `Accept-Language`.

## Tests

- `tests/utils/resolve-language.test.ts` covers user preference precedence over
  cookies, cookie fallback, `Accept-Language` header parsing, `en` default, and `setHtmlLang`.
- `tests/i18n/resolve-client-language.test.ts` covers client resolution order:
  `localStorage` → `cookie` → `browserLanguage` → `defaultLanguage` → `documentLang` → `en`.
- `tests/server/serve-static.test.ts` covers the production catch-all serving stamped HTML
  and forwarding errors to `next()` on rejection.
