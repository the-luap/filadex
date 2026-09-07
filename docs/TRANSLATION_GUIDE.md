# Filadex Translation Guide

Thank you for your interest in contributing translations to Filadex! This guide will help you understand how to contribute translations, the translation process, and guidelines for maintaining consistent terminology.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Translation Process](#translation-process)
3. [File Structure](#file-structure)
4. [Adding a New Language](#adding-a-new-language)
5. [Translation Guidelines](#translation-guidelines)
6. [Terminology Guide](#terminology-guide)
7. [Testing Your Translations](#testing-your-translations)
8. [Submitting Your Contribution](#submitting-your-contribution)

## Getting Started

Filadex uses a simple translation system based on TypeScript files. Each language has its own file containing all the translations for that language. The application currently supports:

- English (en)
- German (de)
- Polish (pl)

We welcome contributions for additional languages!

### Prerequisites

- Basic knowledge of Git and GitHub
- Familiarity with JSON/TypeScript object syntax
- Fluency in the language you want to contribute

## Translation Process

1. **Fork the Repository**: Start by forking the Filadex repository to your GitHub account.

2. **Clone Your Fork**: Clone your fork to your local machine.
   ```
   git clone https://github.com/YOUR_USERNAME/filadex.git
   cd filadex
   ```

3. **Create a Branch**: Create a new branch for your translation work.
   ```
   git checkout -b add-LANGUAGE_CODE-translation
   ```

4. **Add or Update Translations**: Create or modify the translation file for your language.

5. **Test Your Translations**: Run the application locally to verify your translations.

6. **Commit and Push**: Commit your changes and push them to your fork.
   ```
   git add .
   git commit -m "Add LANGUAGE_NAME translations"
   git push origin add-LANGUAGE_CODE-translation
   ```

7. **Create a Pull Request**: Open a pull request from your fork to the main Filadex repository.

## File Structure

Translation files are located in the `client/src/i18n/locales/` directory. Each language has its own file:

- `en.ts` - English (base language)
- `de.ts` - German
- `pl.ts` - Polish
- Add your language file here, e.g., `fr.ts` for French

The translation files follow a nested object structure where keys are organized by feature or component.

## Adding a New Language

To add a new language, every touchpoint in the application must be updated:

1. **Add to supported languages**:
   In `shared/languages.ts`, add the language code to `SUPPORTED_LANGUAGES`:
   ```typescript
   export const SUPPORTED_LANGUAGES = ["en", "de", "pl", "fr"] as const;
   ```

2. **Create translation file**:
   Copy `client/src/i18n/locales/en.ts` to `client/src/i18n/locales/[code].ts` (e.g., `fr.ts`).
   Translate all values, preserving all keys and placeholder tokens (e.g. `{{count}}`).

3. **Register translations in LanguageProvider**:
   In `client/src/i18n/LanguageProvider.tsx`, import your translation file and add it to the `translations` object:
   ```typescript
   import frTranslations from './locales/fr';

   const translations = {
     en: enTranslations,
     de: deTranslations,
     pl: plTranslations,
     fr: frTranslations,
   };
   ```

4. **Add to language selector**:
   In `client/src/components/language-selector.tsx`, add the option to `LANGUAGE_OPTIONS`:
   ```typescript
   const LANGUAGE_OPTIONS: { code: Language; label: string }[] = [
     { code: 'en', label: 'English' },
     { code: 'de', label: 'Deutsch' },
     { code: 'pl', label: 'Polski' },
     { code: 'fr', label: 'Français' },
   ];
   ```

5. **Register date-fns locale**:
   In `client/src/components/filament-modal.tsx`, import the locale from `date-fns/locale` and add to `DATE_LOCALES`:
   ```typescript
   import { de, enUS, pl, fr } from "date-fns/locale";

   const DATE_LOCALES: Record<Language, Locale> = {
     en: enUS,
     de,
     pl,
     fr,
   };
   ```

6. **Add email templates**:
   In `server/utils/email-templates.ts`, add an entry for the new language to each of the five `Record<Language, …>` maps: `VERIFICATION`, `PASSWORD_RESET`, `LOW_STOCK`, `DRYING_REMINDER`, and `CATALOG_REQUEST_REVIEWED`.
   - The maps are keyed by `Language`, so `npx tsc` fails until all five are filled in - a missing locale cannot quietly fall through to English.
   - Scheduled notification checks (`server/utils/notification-checks.ts`) automatically route low-stock and drying-reminder emails using the user's stored language preference via `isSupportedLanguage`.

7. **Verify parity with tests**:
   Run the locale parity test suite:
   ```bash
   npx vitest run tests/i18n/locale-parity.test.ts
   ```

## Translation Guidelines

### General Guidelines

1. **Maintain the same structure**: Keep the same keys and nesting structure as the English file.

2. **Preserve placeholders**: Keep any placeholders like `{{count}}` or `{0}` intact.

3. **Maintain formatting**: Preserve any HTML tags or special formatting in the strings.

4. **Be consistent**: Use consistent terminology throughout the translation.

5. **Be concise**: Keep translations concise, especially for UI elements with limited space.

6. **Context matters**: Consider the context where the text appears in the application.

7. **Use natural language**: Translations should sound natural in the target language.

### Special Considerations

- **Pluralization**: Some languages have different forms for singular and plural. Make sure to handle these correctly.

- **Gender**: Some languages have gendered nouns. Choose the most appropriate form or use gender-neutral language when possible.

- **Formality**: Consider the appropriate level of formality for your language and audience.

## Terminology Guide

To maintain consistency across translations, please use the following terminology for key concepts in Filadex:

| English Term | Description | Example Translations |
|--------------|-------------|----------------------|
| Filament | The 3D printing material | German: "Filament"; Polish: "filament" |
| Spool | The container holding the filament | German: "Spule"; Polish: "szpula" |
| Material | The type of filament (PLA, PETG, etc.) | German: "Material"; Polish: "materiał" |
| Manufacturer | The company that made the filament | German: "Hersteller"; Polish: "producent" |
| Color | The color of the filament | German: "Farbe"; Polish: "kolor" |
| Diameter | The thickness of the filament | German: "Durchmesser"; Polish: "średnica" |
| Storage Location | Where the filament is stored | German: "Lagerort"; Polish: "miejsce przechowywania" |
| Remaining Percentage | How much filament is left | German: "Verbleibender Prozentsatz"; Polish: "pozostały procent" |
| Print Temperature | Temperature for printing | German: "Drucktemperatur"; Polish: "temperatura druku" |
| Total Weight | The total weight of the filament | German: "Gesamtgewicht"; Polish: "waga całkowita" |
| Public Collection | The publicly shared view of a collection | German: "Öffentliche Sammlung"; Polish: "kolekcja publiczna" |
| Catalog Request | A proposal to add an entry to the shared catalog | German: "Kataloganfrage"; Polish: "wniosek katalogowy" |

### Technical Terms

For technical terms related to 3D printing, it's often best to use the established terminology in your language community. If there's no established translation, you can keep the English term.

### UI Elements

| English Term | Description | Example Translations |
|--------------|-------------|----------------------|
| Settings | Application settings | German: "Einstellungen"; Polish: "Ustawienia" |
| Dashboard | Main overview page | German: "Dashboard"; Polish: "Panel" |
| Add | Add a new item | German: "Hinzufügen"; Polish: "Dodaj" |
| Edit | Edit an existing item | German: "Bearbeiten"; Polish: "Edytuj" |
| Delete | Remove an item | German: "Löschen"; Polish: "Usuń" |
| Save | Save changes | German: "Speichern"; Polish: "Zapisz" |
| Cancel | Cancel an action | German: "Abbrechen"; Polish: "Anuluj" |
| Search | Search for items | German: "Suchen"; Polish: "Szukaj" |

## Testing Your Translations

Before submitting your translations, it's important to test them in the application:

1. Install dependencies:
   ```
   cd client
   npm install
   ```

2. Start the development server:
   ```
   npm run dev
   ```

3. Open the application in your browser and switch to your language in the settings.

4. Navigate through the application and verify that all translations appear correctly.

## Submitting Your Contribution

When you're ready to submit your translations:

1. Make sure all your changes are committed and pushed to your fork.

2. Create a pull request to the main Filadex repository.

3. In the pull request description, include:
   - The language you've added or updated
   - Any specific challenges or decisions you made
   - Any parts that might need review or improvement

Thank you for helping make Filadex accessible to more users around the world!
