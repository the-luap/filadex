import { Request, Response, NextFunction } from "express";

/**
 * A browser will submit a cross-site HTML form to any endpoint, and the login
 * response sets a session cookie - so a page on another origin could log a
 * visitor into an account the attacker controls, and collect whatever the
 * visitor then filed under it. Neither SameSite=Lax nor the credential check
 * stops that: the request carries no cookie of the victim's and a top-level
 * form POST is exactly what Lax still allows.
 *
 * Two checks close it, and both only concern requests a browser made:
 *
 *  - Fetch Metadata (`Sec-Fetch-Site`), which the browser sets and a page
 *    cannot forge. "same-origin" is the application's own fetch; "none" is a
 *    typed URL or a bookmark. Anything else is another site driving this one.
 *  - `Origin`, for the browsers that send it without Fetch Metadata.
 *
 * A request from curl or a printer integration carries neither header and is
 * left alone - there is no browser to confuse, and the API-token interface has
 * its own authentication.
 */
export function rejectCrossSiteRequest(req: Request, res: Response, next: NextFunction) {
  const fetchSite = req.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return res.status(403).json({ message: "Cross-site request refused" });
  }

  const origin = req.get("origin");
  if (origin && !isSameOrigin(origin, req.get("host"))) {
    return res.status(403).json({ message: "Cross-site request refused" });
  }

  // An HTML form can only send urlencoded, multipart or plain text, so holding
  // the endpoint to JSON keeps it reachable by the client - which always sends
  // JSON - and out of reach of a form post from another origin.
  if (!req.is("application/json")) {
    return res.status(415).json({ message: "Expected Content-Type: application/json" });
  }

  return next();
}

function isSameOrigin(origin: string, host: string | undefined): boolean {
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    // "null" and anything else unparseable: a sandboxed iframe or a redirected
    // cross-origin request, neither of which is this application's own page.
    return false;
  }
}
