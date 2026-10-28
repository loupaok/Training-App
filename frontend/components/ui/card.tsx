import * as React from "react"
import { cn } from "cn"

function Card({
  className,
  size = "default",
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & {
  size?: "default" | "sm"
  variant?: "default" | "action" | "dark" | "lime" | "stat"
}) {
  return (
    <div
      data-slot="card"
      data-size={size}
      data-variant={variant}
      className={cn(
        "group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-[20px] border border-border bg-card py-(--card-spacing) text-sm text-card-foreground shadow-none [--card-spacing:--spacing(6)] has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(4)] data-[variant=action]:relative data-[variant=action]:before:absolute data-[variant=action]:before:inset-y-0 data-[variant=action]:before:left-0 data-[variant=action]:before:w-1.5 data-[variant=action]:before:bg-accent data-[variant=dark]:border-border data-[variant=dark]:bg-[var(--sp-emphasis)] data-[variant=dark]:text-[var(--sp-emphasis-foreground)] data-[variant=dark]:[&_.text-muted-foreground]:!text-[var(--sp-text-2)] data-[variant=dark]:[&_.text-foreground]:!text-[var(--sp-emphasis-foreground)] data-[variant=dark]:[&_.text-neutral-300]:!text-[var(--sp-text-2)] data-[variant=dark]:[&_.text-neutral-400]:!text-[var(--sp-text-2)] data-[variant=lime]:relative data-[variant=lime]:border-accent data-[variant=lime]:bg-accent data-[variant=lime]:text-accent-foreground data-[variant=lime]:[&_.text-muted-foreground]:!text-black/80 data-[variant=lime]:[&_.text-foreground]:!text-black data-[variant=lime]:before:absolute data-[variant=lime]:before:-right-4 data-[variant=lime]:before:-top-6 data-[variant=lime]:before:h-64 data-[variant=lime]:before:w-4 data-[variant=lime]:before:-skew-x-[18deg] data-[variant=lime]:before:bg-[#0b0b0b] data-[variant=stat]:gap-1 *:[img:first-child]:rounded-t-[20px] *:[img:last-child]:rounded-b-[20px]",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-(--card-spacing) group-data-[variant=action]/card:pl-7 has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "font-heading text-base leading-normal font-extrabold group-data-[size=sm]/card:text-sm group-data-[variant=dark]/card:text-white group-data-[variant=lime]/card:text-accent-foreground",
        className
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground group-data-[variant=dark]/card:text-neutral-300 group-data-[variant=lime]/card:text-accent-foreground/75", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("relative flex flex-col gap-3 px-(--card-spacing) group-data-[variant=action]/card:pl-7", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "relative flex items-center rounded-b-xl px-(--card-spacing) group-data-[variant=action]/card:pl-7 [.border-t]:pt-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

function CardLabel({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="card-label" className={cn("text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground group-data-[variant=dark]/card:text-neutral-400 group-data-[variant=lime]/card:text-accent-foreground/70", className)} {...props} />
}

function CardValue({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="card-value" className={cn("text-2xl font-extrabold leading-none tracking-tight tabular-nums group-data-[variant=dark]/card:text-white group-data-[variant=lime]/card:text-accent-foreground", className)} {...props} />
}

function CardHint({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="card-hint" className={cn("text-xs text-muted-foreground group-data-[variant=dark]/card:text-neutral-300 group-data-[variant=lime]/card:text-accent-foreground/75", className)} {...props} />
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
  CardLabel,
  CardValue,
  CardHint,
}
