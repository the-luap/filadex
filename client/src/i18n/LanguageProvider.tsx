import React, { useState, useEffect } from 'react';
import { LanguageContext, Language, getTranslation, interpolate } from './index';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

// Import language files
import en from './locales/en';
import de from './locales/de';

const translations = {
  en,
  de,
};

interface LanguageProviderProps {
  children: React.ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('en');
  const { toast } = useToast();

  // Check if we're on a public route
  const isPublicRoute = () => {
    const path = window.location.pathname;
    return path.startsWith('/public/');
  };

  // Fetch user settings from API if available and not on a public route
  const { data: userData } = useQuery({
    queryKey: ['/api/auth/me'],
    queryFn: () => apiRequest('/api/auth/me'),
    retry: false,
    enabled: !isPublicRoute(), // Skip this query for public routes
    onError: () => {
      // If not logged in or error, just use browser language or localStorage
    }
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
      toast({
        title: 'Error',
        description: 'Failed to update language preference',
        variant: 'destructive'
      });
    }
  });

  // Initialize language from various sources
  useEffect(() => {
    // Priority:
    // 1. User settings from API (if logged in)
    // 2. localStorage
    // 3. Browser language
    // 4. Environment variable DEFAULT_LANGUAGE
    // 5. Default to English

    if (userData?.language) {
      setLanguageState(userData.language as Language);
      return;
    }

    const storedLanguage = localStorage.getItem('language') as Language;
    if (storedLanguage && (storedLanguage === 'en' || storedLanguage === 'de')) {
      setLanguageState(storedLanguage);
      return;
    }

    // Check browser language
    const browserLanguage = navigator.language.split('-')[0];
    if (browserLanguage === 'de') {
      setLanguageState('de');
      return;
    }

    // Check for environment variable
    // This is injected at build time or runtime via container environment
    if (import.meta.env.VITE_DEFAULT_LANGUAGE) {
      const envLanguage = import.meta.env.VITE_DEFAULT_LANGUAGE as Language;
      if (envLanguage === 'en' || envLanguage === 'de') {
        setLanguageState(envLanguage);
        return;
      }
    }

    // Default to English
    setLanguageState('en');
  }, [userData]);

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
