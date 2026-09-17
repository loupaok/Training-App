"use client"

import * as React from "react"
import { GripVertical } from "lucide-react"
import {
  Group as ResizablePrimitiveGroup,
  Panel as ResizablePrimitivePanel,
  Separator as ResizablePrimitiveSeparator,
  type GroupProps,
  type PanelProps,
  type SeparatorProps,
} from "react-resizable-panels"
import { cn } from "cn"

function ResizablePanelGroup({ className, orientation = "horizontal", ...props }: GroupProps) {
  return (
    <ResizablePrimitiveGroup
      data-slot="resizable-panel-group"
      orientation={orientation}
      className={cn("flex h-full w-full", orientation === "vertical" && "flex-col", className)}
      {...props}
    />
  )
}

function ResizablePanel({ className, ...props }: PanelProps) {
  return <ResizablePrimitivePanel data-slot="resizable-panel" className={cn(className)} {...props} />
}

function ResizableHandle({
  withHandle,
  orientation = "horizontal",
  className,
  ...props
}: SeparatorProps & { withHandle?: boolean; orientation?: "horizontal" | "vertical" }) {
  const isVertical = orientation === "vertical"
  return (
    <ResizablePrimitiveSeparator
      data-slot="resizable-handle"
      className={cn(
        "relative flex items-center justify-center bg-border after:absolute focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        isVertical
          ? "h-px w-full after:inset-x-0 after:top-1/2 after:h-1 after:-translate-y-1/2"
          : "w-px after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2",
        className
      )}
      {...props}
    >
      {withHandle && (
        <div className={cn("z-10 flex items-center justify-center rounded-xs border bg-border", isVertical ? "h-3 w-4 rotate-90" : "h-4 w-3")}>
          <GripVertical className="h-2.5 w-2.5" />
        </div>
      )}
    </ResizablePrimitiveSeparator>
  )
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }
