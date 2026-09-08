import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LanguageContext } from "../../client/src/i18n";
import { UserManagementModal } from "../../client/src/components/user-management-modal";

const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    isAdmin: true,
    user: { id: 1, username: "admin", isAdmin: true },
  }),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: any) => open ? <div data-dialog>{children}</div> : null,
  DialogContent: ({ children, className }: any) => <div data-dialog-content className={className}>{children}</div>,
  DialogHeader: ({ children }: any) => <div data-dialog-header>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
  DialogClose: ({ children }: any) => <button>{children}</button>,
}));

function renderModal(props: { open: boolean }, systemSettings = { registrationEnabled: true }, users = [
  { id: 1, username: "admin", isAdmin: true, lastLogin: null, forceChangePassword: false },
  { id: 2, username: "alice", isAdmin: false, lastLogin: "2026-09-08T12:00:00Z", forceChangePassword: false },
]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  queryClient.setQueryData(["/api/settings/system"], systemSettings);
  queryClient.setQueryData(["users"], users);

  return renderToString(
    <QueryClientProvider client={queryClient}>
      <LanguageContext.Provider
        value={{
          language: "en",
          setLanguage: vi.fn(),
          t: (key: string) => key,
        }}
      >
        <UserManagementModal open={props.open} onOpenChange={vi.fn()} />
      </LanguageContext.Provider>
    </QueryClientProvider>
  );
}

describe("UserManagementModal", () => {
  it("renders registration policy toggle in the users management tab", () => {
    const html = renderModal({ open: true });
    expect(html).toContain("users.registrationEnabled");
    expect(html).toContain("users.registrationEnabledDescription");
    expect(html).toContain('role="switch"');
  });

  it("renders users in a mobile-friendly list with role badges and actions", () => {
    const html = renderModal({ open: true });
    expect(html).toContain("admin");
    expect(html).toContain("alice");
    expect(html).toContain("users.roleAdmin");
    expect(html).toContain("users.roleUser");
    expect(html).toContain("users.edit");
    expect(html).toContain("users.delete");
  });
});
