import { type Language } from "@shared/languages";

interface EmailTemplate {
  subject: string;
  html: string;
}

/**
 * One entry per supported language, so adding a fourth language is a compile
 * error here rather than a silent English email.
 */
type Localized<T> = Record<Language, T>;

function wrapper(bodyHtml: string): string {
  return `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1f2937;">
      <h1 style="font-size: 20px; margin-bottom: 4px;">Filadex</h1>
      ${bodyHtml}
      <p style="font-size: 12px; color: #6b7280; margin-top: 32px;">Filadex</p>
    </div>
  `;
}

/**
 * Filament names, catalog entity labels and review notes are user-supplied and
 * land in HTML mail bodies. Escaped in one place here rather than at each of
 * the interpolation sites.
 *
 * Every one of those values is interpolated into text content, never into an
 * attribute, so quotes need no escaping - and leaving them alone keeps the
 * common "Alice's spool" readable in the mail source. Move a value into an
 * attribute and this has to grow &quot; and &#39;.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const BUTTON_STYLE =
  "display:inline-block;padding:10px 20px;background:#E11D48;color:#fff;text-decoration:none;border-radius:6px;";

const VERIFICATION: Localized<(verifyUrl: string) => EmailTemplate> = {
  pl: (verifyUrl) => ({
    subject: "Potwierdź swój adres e-mail",
    html: wrapper(`
        <p>Witamy w Filadex!</p>
        <p>Potwierdź swój adres e-mail, aby aktywować konto:</p>
        <p><a href="${verifyUrl}" style="${BUTTON_STYLE}">Potwierdź e-mail</a></p>
        <p>Ten link jest ważny przez 24 godziny. Jeśli nie zakładano konta, można zignorować tę wiadomość.</p>
      `),
  }),
  de: (verifyUrl) => ({
    subject: "Bestätige deine E-Mail-Adresse",
    html: wrapper(`
        <p>Willkommen bei Filadex!</p>
        <p>Bitte bestätige deine E-Mail-Adresse, um dein Konto zu aktivieren:</p>
        <p><a href="${verifyUrl}" style="${BUTTON_STYLE}">E-Mail bestätigen</a></p>
        <p>Dieser Link ist 24 Stunden gültig. Falls du kein Konto erstellt hast, kannst du diese E-Mail ignorieren.</p>
      `),
  }),
  en: (verifyUrl) => ({
    subject: "Verify your email address",
    html: wrapper(`
      <p>Welcome to Filadex!</p>
      <p>Please verify your email address to activate your account:</p>
      <p><a href="${verifyUrl}" style="${BUTTON_STYLE}">Verify email</a></p>
      <p>This link is valid for 24 hours. If you didn't create an account, you can ignore this email.</p>
    `),
  }),
};

export function verificationEmail(language: Language, verifyUrl: string): EmailTemplate {
  return VERIFICATION[language](verifyUrl);
}

const PASSWORD_RESET: Localized<(resetUrl: string) => EmailTemplate> = {
  pl: (resetUrl) => ({
    subject: "Zresetuj hasło",
    html: wrapper(`
        <p>Zgłoszono prośbę o zresetowanie hasła.</p>
        <p><a href="${resetUrl}" style="${BUTTON_STYLE}">Zresetuj hasło</a></p>
        <p>Ten link jest ważny przez 1 godzinę. Jeśli to nie była Twoja prośba, można zignorować tę wiadomość.</p>
      `),
  }),
  de: (resetUrl) => ({
    subject: "Passwort zurücksetzen",
    html: wrapper(`
        <p>Du hast angefordert, dein Passwort zurückzusetzen.</p>
        <p><a href="${resetUrl}" style="${BUTTON_STYLE}">Passwort zurücksetzen</a></p>
        <p>Dieser Link ist 1 Stunde gültig. Falls du dies nicht angefordert hast, kannst du diese E-Mail ignorieren.</p>
      `),
  }),
  en: (resetUrl) => ({
    subject: "Reset your password",
    html: wrapper(`
      <p>You requested to reset your password.</p>
      <p><a href="${resetUrl}" style="${BUTTON_STYLE}">Reset password</a></p>
      <p>This link is valid for 1 hour. If you didn't request this, you can ignore this email.</p>
    `),
  }),
};

export function passwordResetEmail(language: Language, resetUrl: string): EmailTemplate {
  return PASSWORD_RESET[language](resetUrl);
}

const LOW_STOCK: Localized<(items: string) => EmailTemplate> = {
  pl: (items) => ({
    subject: "Filadex: Niski stan filamentu",
    html: wrapper(`
        <p>Następujące szpule są prawie puste:</p>
        <ul>${items}</ul>
        <p>Próg powiadomień można dostosować w ustawieniach konta.</p>
      `),
  }),
  de: (items) => ({
    subject: "Filadex: Niedriger Restbestand",
    html: wrapper(`
        <p>Folgende Spulen sind fast leer:</p>
        <ul>${items}</ul>
        <p>Du kannst die Benachrichtigungsschwelle in den Kontoeinstellungen anpassen.</p>
      `),
  }),
  en: (items) => ({
    subject: "Filadex: Low filament stock",
    html: wrapper(`
      <p>The following spools are running low:</p>
      <ul>${items}</ul>
      <p>You can adjust the notification threshold in your account settings.</p>
    `),
  }),
};

export function lowStockEmail(language: Language, filamentNames: string[]): EmailTemplate {
  return LOW_STOCK[language](listItems(filamentNames));
}

const DRYING_REMINDER: Localized<(items: string) => EmailTemplate> = {
  pl: (items) => ({
    subject: "Filadex: Przypomnienie o suszeniu",
    html: wrapper(`
        <p>Następujące szpule wrażliwe na wilgoć nie były suszone od dłuższego czasu:</p>
        <ul>${items}</ul>
        <p>Okres przypomnień można dostosować w ustawieniach konta.</p>
      `),
  }),
  de: (items) => ({
    subject: "Filadex: Trocknungserinnerung",
    html: wrapper(`
        <p>Folgende feuchtigkeitsempfindlichen Spulen wurden längere Zeit nicht getrocknet:</p>
        <ul>${items}</ul>
        <p>Du kannst die Erinnerungsfrist in den Kontoeinstellungen anpassen.</p>
      `),
  }),
  en: (items) => ({
    subject: "Filadex: Drying reminder",
    html: wrapper(`
      <p>The following moisture-sensitive spools haven't been dried in a while:</p>
      <ul>${items}</ul>
      <p>You can adjust the reminder period in your account settings.</p>
    `),
  }),
};

export function dryingReminderEmail(language: Language, filamentNames: string[]): EmailTemplate {
  return DRYING_REMINDER[language](listItems(filamentNames));
}

function listItems(filamentNames: string[]): string {
  return filamentNames.map((name) => `<li>${escapeHtml(name)}</li>`).join("");
}

interface CatalogRequestReviewed {
  approved: boolean;
  entityLabel: string;
  reviewNote?: string | null;
}

const CATALOG_REQUEST_REVIEWED: Localized<(details: CatalogRequestReviewed) => EmailTemplate> = {
  pl: ({ approved, entityLabel, reviewNote }) => ({
    subject: approved ? "Twój wniosek został zatwierdzony" : "Twój wniosek został odrzucony",
    html: wrapper(
      approved
        ? `<p>Twój wniosek dotyczący "${entityLabel}" został zatwierdzony i jest już dostępny.</p>`
        : `<p>Twój wniosek dotyczący "${entityLabel}" został niestety odrzucony.</p>${reviewNote ? `<p>Uwaga: ${reviewNote}</p>` : ""}`
    ),
  }),
  de: ({ approved, entityLabel, reviewNote }) => ({
    subject: approved ? "Deine Anfrage wurde genehmigt" : "Deine Anfrage wurde abgelehnt",
    html: wrapper(
      approved
        ? `<p>Deine Anfrage für "${entityLabel}" wurde genehmigt und ist jetzt verfügbar.</p>`
        : `<p>Deine Anfrage für "${entityLabel}" wurde leider abgelehnt.</p>${reviewNote ? `<p>Anmerkung: ${reviewNote}</p>` : ""}`
    ),
  }),
  en: ({ approved, entityLabel, reviewNote }) => ({
    subject: approved ? "Your request was approved" : "Your request was rejected",
    html: wrapper(
      approved
        ? `<p>Your request for "${entityLabel}" was approved and is now available.</p>`
        : `<p>Your request for "${entityLabel}" was rejected.</p>${reviewNote ? `<p>Note: ${reviewNote}</p>` : ""}`
    ),
  }),
};

export function catalogRequestReviewedEmail(
  language: Language,
  approved: boolean,
  entityLabel: string,
  reviewNote?: string | null
): EmailTemplate {
  return CATALOG_REQUEST_REVIEWED[language]({
    approved,
    entityLabel: escapeHtml(entityLabel),
    reviewNote: reviewNote ? escapeHtml(reviewNote) : reviewNote,
  });
}
