import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LanguageContext } from "../../client/src/i18n";
import { GenericTermsList } from "../../client/src/components/settings/settings-generic-terms";
import { SettingsDialog } from "../../client/src/components/settings-dialog";
import enTranslations from "../../client/src/i18n/locales/en";
import deTranslations from "../../client/src/i18n/locales/de";
import plTranslations from "../../client/src/i18n/locales/pl";

let mockIsAdmin = true;

// Mock auth hook
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    user: { id: 1, username: "testuser", isAdmin: mockIsAdmin },
    isAuthenticated: true,
    isAdmin: mockIsAdmin,
  }),
}));

// Mock Dialog so children are rendered in SSR / renderToString
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: any) => <div>{children}</div>,
  DialogContent: ({ children, className }: any) => <div className={className}>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
}));

// Mock toast
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

function renderWithProviders(component: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return renderToString(
    <QueryClientProvider client={queryClient}>
      <LanguageContext.Provider
        value={{
          language: "en",
          setLanguage: vi.fn(),
          t: (key: string, params?: any) => {
            if (params?.count !== undefined) return `${key}:${params.count}`;
            return key;
          },
        }}
      >
        {component}
      </LanguageContext.Provider>
    </QueryClientProvider>
  );
}

describe("GenericTermsList", () => {
  it("renders the generic terms settings table, search, and add form", () => {
    mockIsAdmin = true;
    const html = renderWithProviders(<GenericTermsList />);

    expect(html).toContain("settings.genericTerms.word");
    expect(html).toContain("settings.genericTerms.wordPlaceholder");
    expect(html).toContain("settings.genericTerms.searchPlaceholder");
    expect(html).toContain("settings.genericTerms.addButton");
    expect(html).toContain("settings.genericTerms.importExport");
  });
});

describe("SettingsDialog Generic Terms Tab", () => {
  it("renders the Generic Terms tab trigger and content when user is admin", () => {
    mockIsAdmin = true;
    const html = renderWithProviders(
      <SettingsDialog open={true} onOpenChange={vi.fn()} />
    );

    expect(html).toContain("generic-terms");
    expect(html).toContain("settings.genericTerms.title");
  });

  it("does not render the Generic Terms tab trigger or content when user is not admin", () => {
    mockIsAdmin = false;
    const html = renderWithProviders(
      <SettingsDialog open={true} onOpenChange={vi.fn()} />
    );

    expect(html).not.toContain("generic-terms");
    expect(html).not.toContain("settings.genericTerms.title");
  });
});

describe("Generic Terms i18n Locales", () => {
  const requiredKeys = [
    "title",
    "description",
    "add",
    "addTitle",
    "addDescription",
    "addButton",
    "word",
    "wordPlaceholder",
    "edit",
    "delete",
    "deleteAll",
    "noGenericTerms",
    "searchPlaceholder",
    "loading",
    "wordRequired",
    "addSuccess",
    "addSuccessDescription",
    "addError",
    "deleteSuccess",
    "deleteSuccessDescription",
    "deleteError",
    "deleteErrorTitle",
    "deleteAllConfirmTitle",
    "deleteAllConfirmDescription",
    "deleteAllConfirm",
    "deleteAllSuccess",
    "deleteAllSuccessDescription",
    "deleteAllError",
    "importExport",
  ] as const;

  it("has all required genericTerms keys in English locale", () => {
    const section = (enTranslations as any).settings.genericTerms;
    expect(section).toBeDefined();
    for (const key of requiredKeys) {
      expect(section[key], `Missing en key: ${key}`).toBeDefined();
    }
  });

  it("has all required genericTerms keys in German locale", () => {
    const section = (deTranslations as any).settings.genericTerms;
    expect(section).toBeDefined();
    for (const key of requiredKeys) {
      expect(section[key], `Missing de key: ${key}`).toBeDefined();
    }
  });

  it("has all required genericTerms keys in Polish locale", () => {
    const section = (plTranslations as any).settings.genericTerms;
    expect(section).toBeDefined();
    for (const key of requiredKeys) {
      expect(section[key], `Missing pl key: ${key}`).toBeDefined();
    }
  });
});
