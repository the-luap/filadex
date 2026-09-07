import { describe, expect, it } from "vitest";
import { SUPPORTED_LANGUAGES } from "../../shared/languages";
import {
  catalogRequestReviewedEmail,
  dryingReminderEmail,
  lowStockEmail,
  passwordResetEmail,
  verificationEmail,
} from "../../server/utils/email-templates";

describe("email templates", () => {
  // Driven by SUPPORTED_LANGUAGES so a locale added without its templates fails
  // here rather than silently mailing English.
  it.each(SUPPORTED_LANGUAGES)("has its own subject line in %s", (language) => {
    const subjects = [
      verificationEmail(language, "https://example.test/verify").subject,
      passwordResetEmail(language, "https://example.test/reset").subject,
      lowStockEmail(language, ["PLA"]).subject,
      dryingReminderEmail(language, ["PLA"]).subject,
      catalogRequestReviewedEmail(language, true, "PLA").subject,
    ];
    for (const subject of subjects) {
      expect(subject).toBeTruthy();
    }
  });

  it("escapes filament names, which users choose", () => {
    const html = lowStockEmail("en", ['<img src=x onerror="alert(1)">']).html;
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("escapes the catalog entity label and the review note", () => {
    const html = catalogRequestReviewedEmail(
      "en",
      false,
      '<b>Label</b>',
      '<script>alert(1)</script>',
    ).html;
    expect(html).not.toContain("<b>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;b&gt;Label&lt;/b&gt;");
    expect(html).toContain("&lt;script&gt;");
  });
});
