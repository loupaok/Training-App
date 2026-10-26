"use client"

import * as React from "react"
import { Switch as SwitchPrimitive } from "@base-ui/react/switch"
import { cn } from "cn"

function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-6 w-10 shrink-0 items-center rounded-full border border-transparent shadow-none transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-[var(--sp-lime-glow)] disabled:cursor-not-allowed disabled:opacity-50 data-checked:bg-accent data-unchecked:bg-input",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-4 rounded-full bg-white shadow-none ring-0 transition-transform data-checked:translate-x-5 data-unchecked:translate-x-0.5 data-checked:bg-[var(--sp-black)]"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
