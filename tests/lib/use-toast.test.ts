import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  toast,
  getToasts,
  DEFAULT_TOAST_DURATION,
  TOAST_REMOVE_DELAY,
} from "../../client/src/hooks/use-toast";

describe("use-toast auto-dismiss and manual dismiss", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Dismiss and clear any lingering toasts
    const toasts = getToasts();
    toasts.forEach((t) => {
      toast({ id: t.id } as any).dismiss();
    });
    vi.advanceTimersByTime(TOAST_REMOVE_DELAY + 100);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("automatically dismisses toast after default timer (5000ms)", () => {
    const { id } = toast({ title: "Auto dismiss test" });

    let current = getToasts().find((t) => t.id === id);
    expect(current).toBeDefined();
    expect(current?.open).toBe(true);

    // Advance right before default timer expires (4999ms)
    vi.advanceTimersByTime(DEFAULT_TOAST_DURATION - 1);
    current = getToasts().find((t) => t.id === id);
    expect(current?.open).toBe(true);

    // Advance 1ms to reach default duration (5000ms)
    vi.advanceTimersByTime(1);
    current = getToasts().find((t) => t.id === id);
    expect(current?.open).toBe(false);

    // Advance remove delay to verify removal from memory
    vi.advanceTimersByTime(TOAST_REMOVE_DELAY);
    current = getToasts().find((t) => t.id === id);
    expect(current).toBeUndefined();
  });

  it("supports custom duration (e.g. 3000ms)", () => {
    const { id } = toast({ title: "Custom duration test", duration: 3000 });

    let current = getToasts().find((t) => t.id === id);
    expect(current?.open).toBe(true);

    vi.advanceTimersByTime(2999);
    current = getToasts().find((t) => t.id === id);
    expect(current?.open).toBe(true);

    vi.advanceTimersByTime(1);
    current = getToasts().find((t) => t.id === id);
    expect(current?.open).toBe(false);
  });

  it("does not auto-dismiss when duration is Infinity", () => {
    const { id } = toast({ title: "Persistent toast", duration: Infinity });

    vi.advanceTimersByTime(30000);
    const current = getToasts().find((t) => t.id === id);
    expect(current?.open).toBe(true);
  });

  it("allows manual dismissal before auto-dismiss timer fires", () => {
    const { id, dismiss } = toast({ title: "Manual close test", duration: 5000 });

    let current = getToasts().find((t) => t.id === id);
    expect(current?.open).toBe(true);

    // Manually close at 1000ms
    vi.advanceTimersByTime(1000);
    dismiss();

    current = getToasts().find((t) => t.id === id);
    expect(current?.open).toBe(false);

    // Verify it is removed after remove delay
    vi.advanceTimersByTime(TOAST_REMOVE_DELAY);
    current = getToasts().find((t) => t.id === id);
    expect(current).toBeUndefined();
  });

  it("handles manual close via onOpenChange(false)", () => {
    const { id } = toast({ title: "Close button simulated test" });

    let current = getToasts().find((t) => t.id === id);
    expect(current?.open).toBe(true);

    // Simulate Radix ToastClose triggering onOpenChange(false)
    current?.onOpenChange?.(false);

    current = getToasts().find((t) => t.id === id);
    expect(current?.open).toBe(false);
  });

  it("renews auto-dismiss timer on toast update", () => {
    const { id, update } = toast({ title: "Initial text", duration: 3000 });

    // Advance 2000ms
    vi.advanceTimersByTime(2000);
    let current = getToasts().find((t) => t.id === id);
    expect(current?.open).toBe(true);

    // Update toast content without changing duration
    update({ id, title: "Updated text" });

    // Advancing 1500ms (total 3500ms from start) should keep toast open due to renewal
    vi.advanceTimersByTime(1500);
    current = getToasts().find((t) => t.id === id);
    expect(current?.open).toBe(true);

    // Advancing another 1500ms (3000ms since update) dismisses it
    vi.advanceTimersByTime(1500);
    current = getToasts().find((t) => t.id === id);
    expect(current?.open).toBe(false);
  });
});
