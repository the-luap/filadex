import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { LanguageContext, Language, getTranslation, interpolate } from './index';
import { getInitialClientLanguage, isSupportedLanguage } from './resolve-language';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/lib/auth';
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
  const [location] = useLocation();
  const { isPublicRoute } = useAuth();

  // The pre-login screens have no account context: a visitor there is picking
  // a language to read the form in, not editing whichever account still has a
  // session cached in this browser.
  const isAnonymousRoute = isPublicRoute(location);

  // A language chosen with no account to write it to. Held so the choice can be
  // pushed to the account once a session appears, instead of being silently
  // reverted by the stored preference the very next render.
  const pendingAccountLanguage = useRef<Language | null>(null);
  
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

  // Fetch user settings from API if available and not on an unauthenticated
  // route. If this errors (not logged in, etc.), userData stays undefined and
  // the effect below falls through to localStorage/browser language.
  const { data: userData } = useQuery({
    queryKey: ['/api/auth/me'],
    queryFn: () => apiRequest('/api/auth/me'),
    retry: false,
    enabled: !isAnonymousRoute,
  });

  // A disabled query still hands back whatever it cached earlier, so the route
  // — not the query — decides whether there is an account in play.
  const account = isAnonymousRoute ? undefined : userData;

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
    // 1. A choice made before the session existed, which the account has not
    //    heard about yet
    // 2. User settings from API (if logged in)
    // 3. Everything getInitialClientLanguage() weighs: localStorage, the
    //    language cookie, the server's <html lang> stamp, the browser
    //    languages, VITE_DEFAULT_LANGUAGE, then English

    if (account?.id) {
      const pending = pendingAccountLanguage.current;
      if (pending) {
        pendingAccountLanguage.current = null;
        if (pending !== account.language) {
          updateLanguageMutation.mutate(pending);
        }
        setLanguageState(pending);
        return;
      }

      if (isSupportedLanguage(account.language)) {
        setLanguageState(account.language);
        return;
      }
    }

    setLanguageState(getInitialClientLanguage());
    // updateLanguageMutation is recreated every render; only the account data
    // should retrigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account]);

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

    // If user is logged in, update preference in database. Otherwise remember
    // it: a language picked on the login screen has to survive logging in.
    if (account?.id) {
      updateLanguageMutation.mutate(newLanguage);
    } else {
      pendingAccountLanguage.current = newLanguage;
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
