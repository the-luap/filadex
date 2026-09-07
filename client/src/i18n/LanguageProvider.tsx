import React, { useState, useEffect } from 'react';
import { LanguageContext, Language, getTranslation, interpolate } from './index';
import { getInitialClientLanguage, resolveClientLanguage, isSupportedLanguage, getCookie, getStorageLanguage, getBrowserLanguages } from './resolve-language';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

// Import language files
import enTranslations from './locales/en';
import deTranslations from './locales/de';
import plTranslations from './locales/pl';

const translations = {
  en: enTranslations,
  de: deTranslations,
  pl: plTranslations,
};

interface LanguageProviderProps {
  children: React.ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(getInitialClientLanguage);
  const { toast } = useToast();
  
  // Temporary translation function for error messages before language is initialized
  const tempT = (key: string): string => {
    const keys = key.split('.');
    let result: any = enTranslations;
    for (const k of keys) {
      if (result[k] === undefined) return key;
      result = result[k];
    }
    return typeof result === 'string' ? result : key;
  };

  // Check if we're on a public route
  const isPublicRoute = () => {
    const path = window.location.pathname;
    return path.startsWith('/public/');
  };

  // Fetch user settings from API if available and not on a public route
  // If this errors (not logged in, etc.), userData stays undefined and the
  // effect below falls through to localStorage/browser language.
  const { data: userData } = useQuery({
    queryKey: ['/api/auth/me'],
    queryFn: () => apiRequest('/api/auth/me'),
    retry: false,
    enabled: !isPublicRoute(), // Skip this query for public routes
  });

  // Update language preference mutation
  const updateLanguageMutation = useMutation({
    mutationFn: (newLanguage: Language) => {
      return apiRequest('/api/users/language', {
        method: 'POST',
        body: JSON.stringify({ language: newLanguage })
      });
    },
    onError: (error) => {
      console.error('Error updating language preference:', error);
      // Use temporary translation function since language might not be initialized yet
      toast({
        title: tempT('common.error'),
        description: tempT('settings.failedToUpdateLanguagePreference'),
        variant: 'destructive'
      });
    }
  });

  // Initialize language from various sources
  useEffect(() => {
    // Priority:
    // 1. User settings from API (if logged in)
    // 2. localStorage
    // 3. language cookie
    // 4. Browser languages (navigator.languages, first supported wins)
    // 5. Environment variable DEFAULT_LANGUAGE
    // 6. document.documentElement.lang (server-rendered)
    // 7. Default to English

    if (userData?.language && isSupportedLanguage(userData.language)) {
      setLanguageState(userData.language);
      return;
    }

    const resolved = resolveClientLanguage({
      localStorage: getStorageLanguage(),
      cookie: getCookie('language'),
      browserLanguages: getBrowserLanguages(),
      defaultLanguage: import.meta.env.VITE_DEFAULT_LANGUAGE,
      documentLang: typeof document !== 'undefined' ? document.documentElement?.lang : null,
    });

    setLanguageState(resolved);
  }, [userData]);

  // Keep the <html lang> attribute and the language cookie (read by the server
  // to server-render the correct lang on the next load) in sync with the
  // active language.
  useEffect(() => {
    document.documentElement.lang = language;
    document.cookie = `language=${language};path=/;max-age=31536000;samesite=lax`;
  }, [language]);

  // Function to set language and persist it
  const setLanguage = (newLanguage: Language) => {
    setLanguageState(newLanguage);
    localStorage.setItem('language', newLanguage);

    // If user is logged in, update preference in database
    if (userData?.id) {
      updateLanguageMutation.mutate(newLanguage);
    }
  };

  // Translation function
  const t = (key: string, params?: Record<string, string | number>): string => {
    const translatedText = getTranslation(translations[language], key);
    return interpolate(translatedText, params);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};
