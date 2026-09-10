import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LanguageContext } from "../../client/src/i18n";
import { CommunityFilamentsSettings } from "../../client/src/components/settings/settings-community-filaments";

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

describe("CommunityFilamentsSettings", () => {
  it("renders status cards for both OFD and SpoolmanDB with refresh actions", () => {
    const html = renderWithProviders(<CommunityFilamentsSettings />);

    expect(html).toContain("settings.communityFilaments.title");
    expect(html).toContain("settings.communityFilaments.ofdTitle");
    expect(html).toContain("settings.communityFilaments.spoolmanTitle");
    expect(html).toContain("settings.communityFilaments.refreshOfd");
    expect(html).toContain("settings.communityFilaments.refreshSpoolman");
    expect(html).toContain("settings.communityFilaments.refreshButton");
  });
});
