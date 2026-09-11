import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LanguageContext } from "../../client/src/i18n";
import { MaterialColorChart } from "../../client/src/components/material-color-chart";

// Mock recharts for SSR / renderToString
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: any) => <div className="responsive-container">{children}</div>,
  PieChart: ({ children, style }: any) => <div style={style}>{children}</div>,
  Pie: ({ children, label }: any) => (
    <div data-testid="pie" data-has-label={typeof label === "function" ? "true" : "false"}>
      {children}
    </div>
  ),
  Cell: ({ fill }: any) => <div data-testid="cell" style={{ backgroundColor: fill }} />,
  Tooltip: () => null,
}));

function renderWithLanguage(component: React.ReactElement) {
  return renderToString(
    <LanguageContext.Provider
      value={{
        language: "en",
        setLanguage: vi.fn(),
        t: (key: string) => key,
      }}
    >
      {component}
    </LanguageContext.Provider>
  );
}

describe("MaterialColorChart", () => {
  const dummyFilaments: any[] = [
    { id: 1, material: "PLA", colorName: "Red", colorCode: "#ff0000" },
    { id: 2, material: "PLA", colorName: "Blue", colorCode: "#0000ff" },
    { id: 3, material: "PETG", colorName: "Black", colorCode: "#000000" },
  ];

  it("renders materials and colors heading", () => {
    const html = renderWithLanguage(<MaterialColorChart filaments={dummyFilaments} />);
    expect(html).toContain("charts.materialsAndColors");
  });

  it("renders mobile labels container with material percentages below graph", () => {
    const html = renderWithLanguage(<MaterialColorChart filaments={dummyFilaments} />);
    expect(html).toContain('data-testid="mobile-chart-labels"');
    expect(html).toContain("PLA");
    expect(html).toContain("PETG");
    expect(html).toContain("67");
    expect(html).toContain("33");
  });
});
