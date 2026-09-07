import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LanguageContext } from "../../client/src/i18n";

// Mock wouter
vi.mock("wouter", () => ({
  useLocation: () => ["/login", vi.fn()],
  useSearch: () => "",
  Link: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

// Mock auth hook
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    login: vi.fn(),
    user: null,
    isAuthenticated: false,
    isAdmin: false,
    isPublicRoute: () => false,
  }),
}));

// Mock toast
vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

// Mock api
vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),
}));

import LoginPage from "../../client/src/pages/login";
import RegisterPage from "../../client/src/pages/register";
import ForgotPasswordPage from "../../client/src/pages/forgot-password";
import ResetPasswordPage from "../../client/src/pages/reset-password";
import VerifyEmailPage from "../../client/src/pages/verify-email";

function renderWithProviders(component: React.ReactElement, lang = "en") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return renderToString(
    <QueryClientProvider client={queryClient}>
      <LanguageContext.Provider
        value={{
          language: lang as any,
          setLanguage: vi.fn(),
          t: (key: string) => key,
        }}
      >
        {component}
      </LanguageContext.Provider>
    </QueryClientProvider>
  );
}

describe("Auth pages LanguageSelector integration", () => {
  it("renders LanguageSelector in LoginPage with current language label", () => {
    const html = renderWithProviders(<LoginPage />, "pl");
    expect(html).toContain("PL");
    expect(html).toContain("settings.language");
  });

  it("renders LanguageSelector in RegisterPage with current language label", () => {
    const html = renderWithProviders(<RegisterPage />, "en");
    expect(html).toContain("EN");
    expect(html).toContain("settings.language");
  });

  it("renders LanguageSelector in ForgotPasswordPage with current language label", () => {
    const html = renderWithProviders(<ForgotPasswordPage />, "de");
    expect(html).toContain("DE");
    expect(html).toContain("settings.language");
  });

  it("renders LanguageSelector in ResetPasswordPage with current language label", () => {
    const html = renderWithProviders(<ResetPasswordPage />, "pl");
    expect(html).toContain("PL");
    expect(html).toContain("settings.language");
  });

  it("renders LanguageSelector in VerifyEmailPage with current language label", () => {
    const html = renderWithProviders(<VerifyEmailPage />, "en");
    expect(html).toContain("EN");
    expect(html).toContain("settings.language");
  });
});
