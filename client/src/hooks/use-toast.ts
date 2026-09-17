import * as React from "react"

import type {
  ToastActionElement,
  ToastProps,
} from "@/components/ui/toast"

const TOAST_LIMIT = 5
const TOAST_REMOVE_DELAY = 1000
const DEFAULT_TOAST_DURATION = 5000

type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const

let count = 0

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

type ActionType = typeof actionTypes

type Action =
  | {
      type: ActionType["ADD_TOAST"]
      toast: ToasterToast
    }
  | {
      type: ActionType["UPDATE_TOAST"]
      toast: Partial<ToasterToast>
    }
  | {
      type: ActionType["DISMISS_TOAST"]
      toastId?: ToasterToast["id"]
    }
  | {
      type: ActionType["REMOVE_TOAST"]
      toastId?: ToasterToast["id"]
    }

interface State {
  toasts: ToasterToast[]
}

interface ToastTimer {
  timeoutId: ReturnType<typeof setTimeout>
  startTime: number
  duration: number
  remaining: number
  isPaused: boolean
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()
const toastTimers = new Map<string, ToastTimer>()

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({
      type: "REMOVE_TOAST",
      toastId: toastId,
    })
  }, TOAST_REMOVE_DELAY)

  toastTimeouts.set(toastId, timeout)
}

const clearDismissTimeout = (toastId?: string) => {
  if (toastId) {
    const existing = toastTimers.get(toastId)
    if (existing) {
      clearTimeout(existing.timeoutId)
      toastTimers.delete(toastId)
    }
  } else {
    toastTimers.forEach((timer) => clearTimeout(timer.timeoutId))
    toastTimers.clear()
  }
}

const scheduleAutoDismiss = (toastId: string, duration?: number) => {
  clearDismissTimeout(toastId)

  const effectiveDuration = duration !== undefined ? duration : DEFAULT_TOAST_DURATION
  if (effectiveDuration === Infinity || effectiveDuration <= 0) {
    return
  }

  const timeoutId = setTimeout(() => {
    toastTimers.delete(toastId)
    dispatch({
      type: "DISMISS_TOAST",
      toastId,
    })
  }, effectiveDuration)

  toastTimers.set(toastId, {
    timeoutId,
    startTime: Date.now(),
    duration: effectiveDuration,
    remaining: effectiveDuration,
    isPaused: false,
  })
}

const pauseToastTimer = (timer: ToastTimer) => {
  if (timer.isPaused) return
  clearTimeout(timer.timeoutId)
  const elapsed = Date.now() - timer.startTime
  timer.remaining = Math.max(0, timer.remaining - elapsed)
  timer.isPaused = true
}

const resumeToastTimer = (toastId: string, timer: ToastTimer) => {
  if (!timer.isPaused) return
  if (timer.remaining <= 0) {
    toastTimers.delete(toastId)
    dispatch({
      type: "DISMISS_TOAST",
      toastId,
    })
    return
  }
  timer.startTime = Date.now()
  timer.isPaused = false
  timer.timeoutId = setTimeout(() => {
    toastTimers.delete(toastId)
    dispatch({
      type: "DISMISS_TOAST",
      toastId,
    })
  }, timer.remaining)
}

function pauseAutoDismiss(toastId?: string) {
  if (toastId) {
    const timer = toastTimers.get(toastId)
    if (timer) pauseToastTimer(timer)
  } else {
    toastTimers.forEach(pauseToastTimer)
  }
}

function resumeAutoDismiss(toastId?: string) {
  if (toastId) {
    const timer = toastTimers.get(toastId)
    if (timer) resumeToastTimer(toastId, timer)
  } else {
    toastTimers.forEach((timer, id) => resumeToastTimer(id, timer))
  }
}

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      }

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      }

    case "DISMISS_TOAST": {
      const { toastId } = action

      clearDismissTimeout(toastId)

      // ! Side effects ! - This could be extracted into a dismissToast() action,
      // but I'll keep it here for simplicity
      if (toastId) {
        addToRemoveQueue(toastId)
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id)
        })
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t
        ),
      }
    }
    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        }
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      }
  }
}

const listeners: Array<(state: State) => void> = []

let memoryState: State = { toasts: [] }

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => {
    listener(memoryState)
  })
}

type Toast = Omit<ToasterToast, "id">

function toast({ ...props }: Toast) {
  const id = genId()

  const update = (updateProps: ToasterToast) => {
    dispatch({
      type: "UPDATE_TOAST",
      toast: { ...updateProps, id },
    })
    scheduleAutoDismiss(id, updateProps.duration ?? props.duration)
  }

  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id })

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss()
      },
    },
  })

  scheduleAutoDismiss(id, props.duration)

  return {
    id: id,
    dismiss,
    update,
  }
}

function dismiss(toastId?: string) {
  dispatch({ type: "DISMISS_TOAST", toastId })
}

function clearToasts() {
  clearDismissTimeout()
  toastTimeouts.forEach((timeout) => clearTimeout(timeout))
  toastTimeouts.clear()
  dispatch({ type: "REMOVE_TOAST" })
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [state])

  return {
    ...state,
    toast,
    dismiss,
    pauseAutoDismiss,
    resumeAutoDismiss,
  }
}

function getToasts(): ToasterToast[] {
  return memoryState.toasts
}

export {
  useToast,
  toast,
  dismiss,
  clearToasts,
  pauseAutoDismiss,
  resumeAutoDismiss,
  getToasts,
  DEFAULT_TOAST_DURATION,
  TOAST_REMOVE_DELAY,
}
