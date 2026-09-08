import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LanguageContext } from "../../client/src/i18n";
import { FilamentModal } from "../../client/src/components/filament-modal";

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
          t: (key: string) => key,
        }}
      >
        {component}
      </LanguageContext.Provider>
    </QueryClientProvider>
  );
}

describe("FilamentModal", () => {
  it("renders catalog source tabs (OFD & SpoolmanDB) when adding a filament", () => {
    const html = renderWithProviders(
      <FilamentModal isOpen={true} onClose={vi.fn()} onSave={vi.fn()} />
    );

    expect(html).toContain("settings.communityFilaments.sourceOfd");
    expect(html).toContain("settings.communityFilaments.sourceSpoolman");
  });

  it("renders barcode field in form", () => {
    const html = renderWithProviders(
      <FilamentModal isOpen={true} onClose={vi.fn()} onSave={vi.fn()} />
    );

    expect(html).toContain("filaments.barcode");
  });
});
