import { describe, expect, it } from "vitest";
import en from "../../client/src/i18n/locales/en";
import de from "../../client/src/i18n/locales/de";
import pl from "../../client/src/i18n/locales/pl";

describe("general settings & registration i18n keys", () => {
  it("translates settings.generalSettings in all locales", () => {
    expect((en as any).settings?.generalSettings).toBe("General Settings");
    expect((pl as any).settings?.generalSettings).toBe("Ustawienia ogólne");
    expect((de as any).settings?.generalSettings).toBe("Allgemeine Einstellungen");
  });

  it("translates registration policy keys in all locales", () => {
    expect((en as any).users?.registrationEnabled).toBe("Allow new user registration");
    expect((pl as any).users?.registrationEnabled).toBe("Zezwalaj na rejestrację nowych użytkowników");
    expect((de as any).users?.registrationEnabled).toBe("Registrierung neuer Benutzer erlauben");

    expect((en as any).users?.registrationEnabledDescription).toBe(
      "When disabled, new accounts can only be created manually by an administrator."
    );
    expect((pl as any).users?.registrationEnabledDescription).toBe(
      "Po wyłączeniu nowe konta mogą być tworzone tylko ręcznie przez administratora."
    );
    expect((de as any).users?.registrationEnabledDescription).toBe(
      "Wenn deaktiviert, können neue Konten nur manuell von einem Administrator erstellt werden."
    );

    expect((en as any).users?.registrationDisabledNotice).toBe("Registration is currently disabled.");
    expect((pl as any).users?.registrationDisabledNotice).toBe("Rejestracja jest obecnie wyłączona.");
    expect((de as any).users?.registrationDisabledNotice).toBe("Die Registrierung ist derzeit deaktiviert.");

    expect((en as any).users?.roleUser).toBe("User");
    expect((pl as any).users?.roleUser).toBe("Użytkownik");
    expect((de as any).users?.roleUser).toBe("Benutzer");

    expect((en as any).users?.roleAdmin).toBe("Admin");
    expect((pl as any).users?.roleAdmin).toBe("Administrator");
    expect((de as any).users?.roleAdmin).toBe("Administrator");
  });
});
