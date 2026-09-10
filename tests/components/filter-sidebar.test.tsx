import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LanguageContext } from "../../client/src/i18n";
import { FilterSidebar } from "../../client/src/components/filter-sidebar";

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

describe("FilterSidebar", () => {
  const defaultProps = {
    onSearchChange: vi.fn(),
    onMaterialChange: vi.fn(),
    onMinRemaining: vi.fn(),
    onManufacturerChange: vi.fn(),
    onColorChange: vi.fn(),
  };

  it("does not render scan button when onScanClick is not provided", () => {
    const html = renderWithProviders(<FilterSidebar {...defaultProps} />);
    expect(html).not.toContain("scanner.scanBarcode");
  });

  it("renders scan button when onScanClick is provided", () => {
    const html = renderWithProviders(
      <FilterSidebar {...defaultProps} onScanClick={vi.fn()} />
    );
    expect(html).toContain("scanner.scanBarcode");
  });

  it("reflects external searchTerm if provided", () => {
    const html = renderWithProviders(
      <FilterSidebar {...defaultProps} searchTerm="9876543210" />
    );
    expect(html).toContain('value="9876543210"');
  });
});
