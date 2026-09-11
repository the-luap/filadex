import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LanguageContext } from "../../client/src/i18n";

const mockNavigate = vi.fn();

vi.mock("wouter", () => ({
  useLocation: () => ["/login", mockNavigate],
  useSearch: () => "",
  Link: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    login: vi.fn(),
    user: null,
    isAuthenticated: false,
    isAdmin: false,
    isPublicRoute: () => false,
  }),
}));

const mockToast = vi.fn();
vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

import LoginPage from "../../client/src/pages/login";
import RegisterPage from "../../client/src/pages/register";

function renderWithClient(component: React.ReactElement, registrationEnabled: boolean) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  queryClient.setQueryData(["/api/system/public-settings"], {
    registrationEnabled,
  });

  return renderToString(
    <QueryClientProvider client={queryClient}>
      <LanguageContext.Provider
        value={{
          language: "en",
          setLanguage: vi.fn(),
          t: (key: string) => key,
        }}
      >
        {component}
      </LanguageContext.Provider>
    </QueryClientProvider>
  );
}

describe("Registration disabled UI", () => {
  describe("LoginPage", () => {
    it("renders the register link when registration is enabled", () => {
      const html = renderWithClient(<LoginPage />, true);
      expect(html).toContain('href="/register"');
    });

    it("hides the register link when registration is disabled", () => {
      const html = renderWithClient(<LoginPage />, false);
      expect(html).not.toContain('href="/register"');
    });
  });

  describe("RegisterPage", () => {
    it("does not render the registration submit button when registration is disabled", () => {
      const html = renderWithClient(<RegisterPage />, false);
      // When registration is disabled, registration form should not be rendered
      expect(html).not.toContain('auth.createAccount');
    });
  });
});
