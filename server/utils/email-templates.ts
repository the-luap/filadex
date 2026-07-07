type Language = "en" | "de";

interface EmailTemplate {
  subject: string;
  html: string;
}

function wrapper(bodyHtml: string): string {
  return `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1f2937;">
      <h1 style="font-size: 20px; margin-bottom: 4px;">Filadex</h1>
      ${bodyHtml}
      <p style="font-size: 12px; color: #6b7280; margin-top: 32px;">Filadex</p>
    </div>
  `;
}

export function verificationEmail(language: Language, verifyUrl: string): EmailTemplate {
  if (language === "de") {
    return {
      subject: "Bestätige deine E-Mail-Adresse",
      html: wrapper(`
        <p>Willkommen bei Filadex!</p>
        <p>Bitte bestätige deine E-Mail-Adresse, um dein Konto zu aktivieren:</p>
        <p><a href="${verifyUrl}" style="display:inline-block;padding:10px 20px;background:#E11D48;color:#fff;text-decoration:none;border-radius:6px;">E-Mail bestätigen</a></p>
        <p>Dieser Link ist 24 Stunden gültig. Falls du kein Konto erstellt hast, kannst du diese E-Mail ignorieren.</p>
      `),
    };
  }
  return {
    subject: "Verify your email address",
    html: wrapper(`
      <p>Welcome to Filadex!</p>
      <p>Please verify your email address to activate your account:</p>
      <p><a href="${verifyUrl}" style="display:inline-block;padding:10px 20px;background:#E11D48;color:#fff;text-decoration:none;border-radius:6px;">Verify email</a></p>
      <p>This link is valid for 24 hours. If you didn't create an account, you can ignore this email.</p>
    `),
  };
}

export function passwordResetEmail(language: Language, resetUrl: string): EmailTemplate {
  if (language === "de") {
    return {
      subject: "Passwort zurücksetzen",
      html: wrapper(`
        <p>Du hast angefordert, dein Passwort zurückzusetzen.</p>
        <p><a href="${resetUrl}" style="display:inline-block;padding:10px 20px;background:#E11D48;color:#fff;text-decoration:none;border-radius:6px;">Passwort zurücksetzen</a></p>
        <p>Dieser Link ist 1 Stunde gültig. Falls du dies nicht angefordert hast, kannst du diese E-Mail ignorieren.</p>
      `),
    };
  }
  return {
    subject: "Reset your password",
    html: wrapper(`
      <p>You requested to reset your password.</p>
      <p><a href="${resetUrl}" style="display:inline-block;padding:10px 20px;background:#E11D48;color:#fff;text-decoration:none;border-radius:6px;">Reset password</a></p>
      <p>This link is valid for 1 hour. If you didn't request this, you can ignore this email.</p>
    `),
  };
}

export function lowStockEmail(language: Language, filamentNames: string[]): EmailTemplate {
  const items = filamentNames.map((name) => `<li>${name}</li>`).join("");
  if (language === "de") {
    return {
      subject: "Filadex: Niedriger Restbestand",
      html: wrapper(`
        <p>Folgende Spulen sind fast leer:</p>
        <ul>${items}</ul>
        <p>Du kannst die Benachrichtigungsschwelle in den Kontoeinstellungen anpassen.</p>
      `),
    };
  }
  return {
    subject: "Filadex: Low filament stock",
    html: wrapper(`
      <p>The following spools are running low:</p>
      <ul>${items}</ul>
      <p>You can adjust the notification threshold in your account settings.</p>
    `),
  };
}

export function dryingReminderEmail(language: Language, filamentNames: string[]): EmailTemplate {
  const items = filamentNames.map((name) => `<li>${name}</li>`).join("");
  if (language === "de") {
    return {
      subject: "Filadex: Trocknungserinnerung",
      html: wrapper(`
        <p>Folgende feuchtigkeitsempfindlichen Spulen wurden längere Zeit nicht getrocknet:</p>
        <ul>${items}</ul>
        <p>Du kannst die Erinnerungsfrist in den Kontoeinstellungen anpassen.</p>
      `),
    };
  }
  return {
    subject: "Filadex: Drying reminder",
    html: wrapper(`
      <p>The following moisture-sensitive spools haven't been dried in a while:</p>
      <ul>${items}</ul>
      <p>You can adjust the reminder period in your account settings.</p>
    `),
  };
}

export function catalogRequestReviewedEmail(
  language: Language,
  approved: boolean,
  entityLabel: string,
  reviewNote?: string | null
): EmailTemplate {
  if (language === "de") {
    return {
      subject: approved ? "Deine Anfrage wurde genehmigt" : "Deine Anfrage wurde abgelehnt",
      html: wrapper(
        approved
          ? `<p>Deine Anfrage für "${entityLabel}" wurde genehmigt und ist jetzt verfügbar.</p>`
          : `<p>Deine Anfrage für "${entityLabel}" wurde leider abgelehnt.</p>${reviewNote ? `<p>Anmerkung: ${reviewNote}</p>` : ""}`
      ),
    };
  }
  return {
    subject: approved ? "Your request was approved" : "Your request was rejected",
    html: wrapper(
      approved
        ? `<p>Your request for "${entityLabel}" was approved and is now available.</p>`
        : `<p>Your request for "${entityLabel}" was rejected.</p>${reviewNote ? `<p>Note: ${reviewNote}</p>` : ""}`
    ),
  };
}
