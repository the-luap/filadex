---
status: accepted
date: 2026-09-18
---

# Toast Lifecycle Timer Deduplication and Single Source of Timing Authority

This architecture decision records the consolidation of toast lifecycle management and auto-dismiss timing into `use-toast.ts`, eliminating duplicate racing timers between Radix UI primitives and application state.

## Context

1. **Dual Timer Conflict**:
   - Filadex manages toast state in memory via [`client/src/hooks/use-toast.ts`](../../client/src/hooks/use-toast.ts), featuring custom auto-dismiss scheduling (`scheduleAutoDismiss`), hover/focus pause-and-resume calculations (`pauseAutoDismiss`, `resumeAutoDismiss`), exit animation coordination, and delayed garbage collection (`addToRemoveQueue` with `TOAST_REMOVE_DELAY`).
   - Simultaneously, [`client/src/components/ui/toaster.tsx`](../../client/src/components/ui/toaster.tsx) wrapped rendered toasts in `<ToastProvider duration={5000}>`.
   - In Radix UI (`@radix-ui/react-toast`), `ToastProvider` populates a context duration (defaulting to 5000ms if not disabled). Each rendered `<Toast>` computes `const duration = durationProp || context.duration`. If `durationProp` is undefined, Radix defaults to the context duration and spawns an internal `window.setTimeout(handleClose, 5000)`.
   - This caused two separate timers to run concurrently for every toast: Radix's internal timer and `scheduleAutoDismiss`.

2. **Negative Architectural Consequences**:
   - **Silent Override of Default Duration**: If `DEFAULT_TOAST_DURATION` in `use-toast.ts` were increased (e.g. to 8000ms), Radix's 5000ms timer would fire first and close the toast at 5000ms, silently negating any configuration greater than 5000ms.
   - **Persistent Toasts (`duration: Infinity`)**: A toast intended to remain open indefinitely or until manual interaction could still be subject to Radix's fallback provider timer if duration props are not propagated to Radix correctly or if Radix's provider timer is active.
   - **Custom Durations Race**: When custom durations (such as 3000ms) were specified, both Radix and `scheduleAutoDismiss` ran redundant timers competing to trigger dismiss events.
   - **Split Source of Truth**: The toast state lifecycle was split between the unmounted state machine (`use-toast.ts`) and mounted Radix DOM instances (`ToastImpl`), violating single-responsibility principles and creating fragile timer synchronization.

## Decision

### 1. Single Source of Truth in `use-toast.ts`
- [`client/src/hooks/use-toast.ts`](../../client/src/hooks/use-toast.ts) is the sole authoritative manager for toast lifetimes, durations, pauses, and cleanup.
- All auto-dismiss timing logic, pause/resume tracking on hover/focus, and transition to removal delay are orchestrated exclusively through `scheduleAutoDismiss`, `pauseAutoDismiss`, and `resumeAutoDismiss`.

### 2. Disabling Radix UI's Internal Timer in `Toaster`
- In [`client/src/components/ui/toaster.tsx`](../../client/src/components/ui/toaster.tsx), `<ToastProvider>` is configured with `duration={Infinity}`:
  ```tsx
  <ToastProvider duration={Infinity}>
  ```
  In Radix UI, setting `duration: Infinity` on the provider sets `context.duration = Infinity`.
- In `toasts.map(...)`, `duration` is extracted and omitted when spreading props onto `<Toast key={id} {...props}>`:
  ```tsx
  {toasts.map(function ({ id, title, description, action, duration: _duration, ...props }) {
    return (
      <Toast key={id} {...props}>
  ```
  By omitting `duration` from the `<Toast>` props and supplying `duration={Infinity}` at the provider level, Radix's internal `duration = durationProp || context.duration` evaluates to `Infinity`. Radix's internal `startTimer` explicitly checks `if (!duration || duration === Infinity) return`, ensuring Radix never schedules any `setTimeout`.

### 3. Verification & Guardrails
- Automated tests verify:
  - `DEFAULT_TOAST_DURATION` changes take effect deterministically.
  - Toasts with `duration: Infinity` remain open without being dismissed by Radix.
  - Custom durations (e.g. 3000ms) are respected cleanly without duplicate timer racing.

## Consequences

- **Deterministic Timing**: Changing `DEFAULT_TOAST_DURATION` in `use-toast.ts` immediately and reliably takes effect across the application.
- **Persistent Toasts Supported**: `toast({ duration: Infinity })` remains open until explicitly dismissed by user interaction or programmatically.
- **Cleaner Lifecycle**: Eliminated race conditions between Radix's DOM event loop timer and `use-toast`'s state machine.
- **Preserved Accessibility & Animations**: Radix still handles all keyboard navigation (Escape, focus management), ARIA attributes, swipe dismiss gestures, and open/close animation lifecycle states without interfering with the timer.
