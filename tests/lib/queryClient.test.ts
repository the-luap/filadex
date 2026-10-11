import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ApiError, throwIfResNotOk, apiRequest, queryClient, retireAccountScopedCache } from "../../client/src/lib/queryClient";

describe("ApiError and queryClient error handling contract", () => {
  let consoleErrorSpy: any;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it("ApiError conforms to Error contract with status and data", () => {
    const error = new ApiError(404, "Not found", { foo: "bar" });
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.name).toBe("ApiError");
    expect(error.status).toBe(404);
    expect(error.message).toBe("Not found");
    expect(error.data).toEqual({ foo: "bar" });
  });

  it("throwIfResNotOk does not throw for successful responses", async () => {
    const res = new Response(JSON.stringify({ ok: true }), { status: 200 });
    await expect(throwIfResNotOk(res)).resolves.toBeUndefined();
  });

  it("throwIfResNotOk throws ApiError extracting JSON message on 404", async () => {
    const res = new Response(JSON.stringify({ message: "Filament not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });

    let caught: any = null;
    try {
      await throwIfResNotOk(res);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeDefined();
    expect(caught).toBeInstanceOf(Error);
    expect(caught).toBeInstanceOf(ApiError);
    expect(caught.status).toBe(404);
    expect(caught.message).toBe("Filament not found");
    expect(caught.data).toEqual({ message: "Filament not found" });
  });

  it("throwIfResNotOk extracts detail when message is omitted", async () => {
    const res = new Response(JSON.stringify({ detail: "Detailed not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });

    let caught: any = null;
    try {
      await throwIfResNotOk(res);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ApiError);
    expect(caught.status).toBe(404);
    expect(caught.message).toBe("Detailed not found");
  });

  it("throwIfResNotOk throws ApiError for non-JSON error bodies", async () => {
    const res = new Response("Bad Gateway", {
      status: 502,
      statusText: "Bad Gateway",
    });

    let caught: any = null;
    try {
      await throwIfResNotOk(res);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(Error);
    expect(caught).toBeInstanceOf(ApiError);
    expect(caught.status).toBe(502);
    expect(caught.message).toBe("502: Bad Gateway");
    expect(caught.data).toBeUndefined();
  });

  it("apiRequest does not log 401 errors on /api/auth endpoints", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "Invalid credentials" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", mockFetch);

    await expect(apiRequest("/api/auth/login", { method: "POST" })).rejects.toThrow();

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("apiRequest logs errors for 401 on non-auth endpoints", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", mockFetch);

    await expect(apiRequest("/api/filaments")).rejects.toThrow();

    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("apiRequest logs non-401 errors even on auth endpoints", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", mockFetch);

    await expect(apiRequest("/api/auth/login", { method: "POST" })).rejects.toThrow();

    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("apiRequest returns undefined for 204 No Content", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(null, { status: 204 })
    );
    vi.stubGlobal("fetch", mockFetch);

    const result = await apiRequest("/api/filaments/123", { method: "DELETE" });
    expect(result).toBeUndefined();
  });
});

/**
 * The SPA mounts one QueryClient above every account, and private queries are
 * keyed by endpoint alone. Signing out and back in as somebody else used to
 * leave the first account's rows in that cache, where the second account's
 * components read them while their own request was still in flight.
 */
describe("account-scoped cache retirement", () => {
  it("drops cached private results", () => {
    queryClient.setQueryData(["/api/filaments"], [{ id: 1, name: "Alice's PETG" }]);
    queryClient.setQueryData(["/api/statistics"], { totalPurchaseValue: 1234 });

    retireAccountScopedCache();

    expect(queryClient.getQueryData(["/api/filaments"])).toBeUndefined();
    expect(queryClient.getQueryData(["/api/statistics"])).toBeUndefined();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });
});
