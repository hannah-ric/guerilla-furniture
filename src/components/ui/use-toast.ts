import * as React from "react"

export interface Toast {
  id: string
  title?: string
  description?: string
  variant?: "default" | "destructive"
}

interface ToastContextType {
  toasts: Toast[]
  toast: (toast: Omit<Toast, "id">) => void
  dismiss: (toastId?: string) => void
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined)

export function useToast() {
  const context = React.useContext(ToastContext)
  
  if (!context) {
    // Return a mock implementation for now
    return {
      toast: (toast: Omit<Toast, "id">) => {
        console.log('Toast:', toast)
      },
      toasts: [],
      dismiss: () => {}
    }
  }
  
  return context
}
