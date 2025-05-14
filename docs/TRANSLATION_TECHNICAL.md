# Filadex Technical Translation Guide

This document provides technical details about the translation system in Filadex for developers who need to add or modify translatable content.

## Table of Contents

1. [Translation Architecture](#translation-architecture)
2. [Adding Translatable Content](#adding-translatable-content)
3. [Dynamic Translations](#dynamic-translations)
4. [Translation Keys Structure](#translation-keys-structure)
5. [Best Practices](#best-practices)
6. [Common Issues and Solutions](#common-issues-and-solutions)

## Translation Architecture

Filadex uses [i18next](https://www.i18next.com/) for internationalization. The translation system is set up in the `client/src/i18n` directory:

- `index.ts`: Main configuration file for i18next
- `locales/`: Directory containing translation files for each language
  - `en.ts`: English translations (base language)
  - `de.ts`: German translations
  - Additional language files as they are added

### How It Works

1. The `i18n/index.ts` file initializes i18next with the available languages and resources.
2. The `useTranslation` hook is used in components to access the translation function.
3. Translation keys are organized in a nested structure by feature or component.

## Adding Translatable Content

### Basic Usage

To add translatable content to a component:

```tsx
import { useTranslation } from "@/i18n";

export function MyComponent() {
  const { t } = useTranslation();
  
  return (
    <div>
      <h1>{t('myComponent.title')}</h1>
      <p>{t('myComponent.description')}</p>
    </div>
  );
}
```

### Adding New Translation Keys

When adding new translatable content:

1. Add the key to the English translation file (`en.ts`) first.
2. Add the same key to all other language files.
3. Use a logical nesting structure based on the feature or component.

Example addition to `en.ts`:

```typescript
export default {
  // Existing translations...
  myComponent: {
    title: 'My Component',
    description: 'This is my component description',
  },
};
```

### Handling Variables

To include variables in translations:

```tsx
// In the translation file
{
  greeting: 'Hello, {{name}}!',
  itemCount: 'You have {{count}} items',
}

// In the component
t('greeting', { name: 'John' })
t('itemCount', { count: 5 })
```

## Dynamic Translations

### Form Validation Messages

For form validation messages that need to be translated, create a function that generates the schema with translations:

```typescript
// Create a function to generate the schema with translations
const createFormSchema = (t: (key: string) => string) => z.object({
  username: z.string().min(3, t('users.usernameMinLength')),
  password: z.string().min(6, t('auth.passwordRequirements')),
});

// In your component
const { t } = useTranslation();
const formSchema = createFormSchema(t);
```

### Dynamic Lists

For lists of items that need translations (like material types or colors):

```typescript
// Create a function to generate the list with translations
const createMaterialTypes = (t: (key: string) => string) => [
  { value: "PLA", label: "PLA" },
  { value: "PETG", label: "PETG" },
  { value: "ABS", label: "ABS" },
  { value: "PA", label: `PA (${t('materials.nylon')})` },
  // ...
];

// In your component
const { t } = useTranslation();
const materialTypes = createMaterialTypes(t);
```

## Translation Keys Structure

We use a nested structure for translation keys to organize them by feature or component:

```
app                   # Application-wide translations
  title
  description
  version
common                # Common UI elements
  add
  edit
  delete
  cancel
  save
  ...
auth                  # Authentication-related
  login
  logout
  username
  password
  ...
filaments             # Filament-related
  addFilament
  editFilament
  name
  material
  ...
settings              # Settings-related
  title
  appearance
  language
  ...
  manufacturers       # Nested for sub-features
    title
    add
    ...
  materials
    ...
  colors
    ...
```

## Best Practices

### 1. Use Semantic Keys

Use semantic keys that describe the purpose of the text, not the text itself:

```typescript
// Good
{
  'auth.loginButton': 'Login',
}

// Bad
{
  'login': 'Login',
}
```

### 2. Keep Components Translation-Ready

Always design components with translation in mind:

- Avoid hardcoded strings
- Allow for text expansion (some languages need more space)
- Use flexible layouts

### 3. Provide Context for Translators

Add comments in the translation files to provide context for translators:

```typescript
{
  // Used on the login button
  'auth.loginButton': 'Login',
  
  // Used as a title on the dashboard
  'dashboard.title': 'Dashboard',
}
```

### 4. Handle Pluralization

Use i18next's pluralization features for content that changes based on count:

```typescript
{
  'items': 'You have {{count}} item',
  'items_plural': 'You have {{count}} items',
}
```

### 5. Keep Translations in Sync

When adding or modifying features, update all language files at the same time to keep them in sync.

## Common Issues and Solutions

### Missing Translations

If a translation key is missing, i18next will fall back to the English version. To find missing translations, you can enable debug mode in i18next configuration.

### Dynamic Content

For dynamic content like form validation messages, create functions that generate the content with translations as shown in the [Dynamic Translations](#dynamic-translations) section.

### Testing Translations

To test translations:

1. Switch the language in the application settings
2. Navigate through all parts of the application
3. Check for untranslated text or formatting issues

### Handling HTML in Translations

If you need to include HTML in translations, use the `Trans` component from i18next:

```tsx
import { Trans } from 'react-i18next';

// In your component
<Trans i18nKey="myHtmlContent">
  This is <strong>bold</strong> text.
</Trans>

// In your translation file
{
  'myHtmlContent': 'This is <1>bold</1> text.'
}
```

### Language Detection

The application detects the user's preferred language from browser settings but also allows manual selection in the settings. The selected language is stored in local storage for persistence.
