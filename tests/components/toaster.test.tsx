import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi, beforeEach } from "vitest";

// Spy on Toast and ToastProvider props
const toastProviderProps: any[] = [];
const toastProps: any[] = [];

vi.mock("@/components/ui/toast", async () => {
  const actual = await vi.importActual<any>("@/components/ui/toast");
  return {
    ...actual,
    ToastProvider: (props: any) => {
      toastProviderProps.push(props);
      return <div data-testid="toast-provider">{props.children}</div>;
    },
    ToastViewport: () => <div data-testid="toast-viewport" />,
    Toast: (props: any) => {
      toastProps.push(props);
      return <div data-testid="toast-item">{props.children}</div>;
    },
  };
});

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toasts: [
      {
        id: "toast-1",
        title: "Standard Toast",
        description: "Standard description",
        duration: 5000,
        open: true,
      },
      {
        id: "toast-2",
        title: "Custom Duration Toast",
        description: "Custom duration",
        duration: 3000,
        open: true,
      },
      {
        id: "toast-3",
        title: "Persistent Toast",
        description: "Infinite duration",
        duration: Infinity,
        open: true,
      },
    ],
  }),
}));

import { Toaster } from "../../client/src/components/ui/toaster";

describe("Toaster timer deduplication", () => {
  beforeEach(() => {
    toastProviderProps.length = 0;
    toastProps.length = 0;
  });

  it("configures ToastProvider with duration Infinity to disable Radix fallback timer", () => {
    renderToString(<Toaster />);

    expect(toastProviderProps).toHaveLength(1);
    expect(toastProviderProps[0].duration).toBe(Infinity);
  });

  it("omits duration from Toast props to prevent Radix from running per-toast timers", () => {
    renderToString(<Toaster />);

    expect(toastProps).toHaveLength(3);
    for (const renderedProps of toastProps) {
      expect(renderedProps.duration).toBeUndefined();
    }
  });
});
