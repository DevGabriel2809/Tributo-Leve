import * as React from "react"
import { cn } from "@/lib/utils"

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn("h-12 w-full rounded-xl border border-black/20 bg-white px-4 text-base outline-none transition-all placeholder:text-black/35 hover:border-black/40 focus:border-black focus:ring-4 focus:ring-mint/70 disabled:bg-black/5", className)}
    {...props}
  />
))
Input.displayName = "Input"
