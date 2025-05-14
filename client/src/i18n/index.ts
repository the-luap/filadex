import { createContext, useContext } from 'react';

// Define available languages
export type Language = 'en' | 'de';

// Define the structure of our translations
export interface Translations {
  [key: string]: string | Translations;
}

// Create a context for our language provider
export interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  t: (key) => key,
});

// Custom hook to use translations
export const useTranslation = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
};

// Helper function to get nested translations
export const getTranslation = (translations: Translations, key: string): string => {
  const keys = key.split('.');
  let result: any = translations;

  for (const k of keys) {
    if (result[k] === undefined) {
      console.warn(`Translation key not found: ${key}`);
      return key;
    }
    result = result[k];
  }

  if (typeof result !== 'string') {
    console.warn(`Translation key does not resolve to a string: ${key}`);
    return key;
  }

  return result;
};

// Helper function to interpolate parameters in translations
export const interpolate = (text: string, params?: Record<string, string | number>): string => {
  if (!params) return text;
  
  return Object.entries(params).reduce((result, [key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    return result.replace(regex, String(value));
  }, text);
};
