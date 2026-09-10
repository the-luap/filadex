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

// Mock Select so items are rendered in SSR / renderToString
vi.mock("@/components/ui/select", () => ({
  Select: ({ children, value }: any) => <div data-select-value={value}>{children}</div>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ value, children }: any) => <div data-select-item={value}>{children}</div>,
}));

// Mock toast
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

function renderWithProviders(component: React.ReactElement, client?: QueryClient) {
  const queryClient = client || new QueryClient({
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

  it("treats pre-filled template with id 0 as adding (not editing)", () => {
    const template: any = {
      id: 0,
      name: "Prusament PLA Galaxy Black",
      manufacturer: "Prusa",
      material: "PLA",
      barcode: "123456789",
    };

    const html = renderWithProviders(
      <FilamentModal isOpen={true} onClose={vi.fn()} onSave={vi.fn()} filament={template} />
    );

    expect(html).toContain("filaments.addFilament");
    expect(html).not.toContain("filaments.editFilament");
    expect(html).toContain("settings.communityFilaments.sourceOfd");
  });

  it("does not duplicate materials when a database material matches a predefined material", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(["/api/materials"], [{ id: 101, name: "PLA" }]);

    const html = renderWithProviders(
      <FilamentModal isOpen={true} onClose={vi.fn()} onSave={vi.fn()} />,
      queryClient
    );

    const plaMatches = html.match(/data-select-item="PLA"/g);
    expect(plaMatches).toHaveLength(1);
  });

  it("renders color template and required color code field", () => {
    const html = renderWithProviders(
      <FilamentModal isOpen={true} onClose={vi.fn()} onSave={vi.fn()} />
    );

    expect(html).toContain("filaments.colorTemplate");
    expect(html).toContain("filaments.colorCode");
  });

  it("renders select item for a manufacturer not yet present in predefined list", () => {
    const template: any = {
      id: 1,
      name: "Special Spool",
      manufacturer: "UniqueManufacturerBrand",
      material: "PLA",
      colorCode: "#ff0000",
      totalWeight: 1,
      remainingPercentage: 100,
    };

    const html = renderWithProviders(
      <FilamentModal isOpen={true} onClose={vi.fn()} onSave={vi.fn()} filament={template} />
    );

    expect(html).toContain('data-select-item="UniqueManufacturerBrand"');
  });

  it("renders select item for a custom material not yet present in predefined list", () => {
    const template: any = {
      id: 1,
      name: "Special Spool",
      manufacturer: "Bambu Lab",
      material: "PEEK-Custom",
      colorCode: "#ff0000",
      totalWeight: 1,
      remainingPercentage: 100,
    };

    const html = renderWithProviders(
      <FilamentModal isOpen={true} onClose={vi.fn()} onSave={vi.fn()} filament={template} />
    );

    expect(html).toContain('data-select-item="PEEK-Custom"');
  });
});

