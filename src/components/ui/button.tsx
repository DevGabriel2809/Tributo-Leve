import * as React from "react"
import { cn } from "@/lib/utils"

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger"
}

export const Button = React.forwardRef<HTMLButtonElement, Props>(({ className, variant = "primary", ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all duration-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-mint/60 disabled:pointer-events-none disabled:opacity-40 active:translate-y-0",
      variant === "primary" && "bg-ink text-white shadow-[0_6px_0_rgba(16,19,16,.14)] hover:-translate-y-0.5 hover:bg-[#243129]",
      variant === "secondary" && "border border-black/15 bg-white text-ink hover:-translate-y-0.5 hover:border-black/40 hover:shadow-lg",
      variant === "ghost" && "bg-transparent text-current hover:bg-black/5",
      variant === "danger" && "bg-red-600 text-white hover:bg-red-700",
      className
    )}
    {...props}
  />
))
Button.displayName = "Button"
