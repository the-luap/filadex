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
- Add your language file here, e.g., `fr.ts` for French

The translation files follow a nested object structure where keys are organized by feature or component.

## Adding a New Language

To add a new language:

1. Copy the English translation file (`en.ts`) to a new file named with your language code (e.g., `fr.ts` for French).

2. Translate all the values in the file, keeping the keys and structure exactly the same.

3. Add your language to the language list in `client/src/i18n/index.ts`:

```typescript
// Add your language import
import frTranslations from './locales/fr';

// Add to the resources object
const resources = {
  en: {
    translation: enTranslations
  },
  de: {
    translation: deTranslations
  },
  fr: {
    translation: frTranslations
  }
  // Add more languages here
};
```

4. Add your language to the language options in the settings component.

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
| Filament | The 3D printing material | German: "Filament" |
| Spool | The container holding the filament | German: "Spule" |
| Material | The type of filament (PLA, PETG, etc.) | German: "Material" |
| Manufacturer | The company that made the filament | German: "Hersteller" |
| Color | The color of the filament | German: "Farbe" |
| Diameter | The thickness of the filament | German: "Durchmesser" |
| Storage Location | Where the filament is stored | German: "Lagerort" |
| Remaining Percentage | How much filament is left | German: "Verbleibender Prozentsatz" |
| Print Temperature | Temperature for printing | German: "Drucktemperatur" |
| Total Weight | The total weight of the filament | German: "Gesamtgewicht" |

### Technical Terms

For technical terms related to 3D printing, it's often best to use the established terminology in your language community. If there's no established translation, you can keep the English term.

### UI Elements

| English Term | Description | Example Translations |
|--------------|-------------|----------------------|
| Settings | Application settings | German: "Einstellungen" |
| Dashboard | Main overview page | German: "Dashboard" |
| Add | Add a new item | German: "Hinzufügen" |
| Edit | Edit an existing item | German: "Bearbeiten" |
| Delete | Remove an item | German: "Löschen" |
| Save | Save changes | German: "Speichern" |
| Cancel | Cancel an action | German: "Abbrechen" |
| Search | Search for items | German: "Suchen" |

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
