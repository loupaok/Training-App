"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, LockKeyhole } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { clientNavSections, isActivePath } from "@/lib/nav-config"

const primaryKeys = new Set(["dashboard", "training", "nutrition", "progress"])

export function ClientBottomNav({ paymentApproved, unreadNotifications = 0, unreadMessages = 0 }: { paymentApproved: boolean; unreadNotifications?: number; unreadMessages?: number }) {
  const pathname = usePathname()
  const primaryItems = clientNavSections.filter((item) => primaryKeys.has(item.key))
  const moreItems = clientNavSections.filter((item) => !primaryKeys.has(item.key))
  const moreActive = moreItems.some((item) => isActivePath(pathname, item.path))

  return <nav aria-label="Κύρια πλοήγηση" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] supports-backdrop-filter:backdrop-blur lg:hidden">
    <div className="mx-auto grid max-w-xl grid-cols-5 gap-1">
      {primaryItems.map((item) => <BottomItem key={item.key} item={item} active={isActivePath(pathname, item.path)} locked={Boolean(item.locked && !paymentApproved)} />)}
      <Sheet>
        <SheetTrigger render={<button type="button" className={cn("relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-medium transition-colors", moreActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")} />}>
          <Menu className="h-5 w-5" />
          <span>Περισσότερα</span>
          {unreadNotifications + unreadMessages > 0 && <Badge className="absolute top-1 right-2 grid h-4 min-w-4 place-items-center rounded-full p-0 text-[9px]">{unreadNotifications + unreadMessages > 9 ? "9+" : unreadNotifications + unreadMessages}</Badge>}
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[80dvh] rounded-t-2xl p-0" showCloseButton>
          <SheetHeader className="border-b px-5 pt-5 pb-4 text-left"><SheetTitle>Περισσότερα</SheetTitle><SheetDescription>Όλες οι επιλογές του λογαριασμού σου.</SheetDescription></SheetHeader>
          <div className="grid gap-1 p-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            {moreItems.map((item) => <MoreItem key={item.key} item={item} active={isActivePath(pathname, item.path)} locked={Boolean(item.locked && !paymentApproved)} unreadNotifications={item.key === "notifications" ? unreadNotifications : item.key === "messages" ? unreadMessages : 0} />)}
            <Link href="/client-profile" className="flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">Προφίλ</Link>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  </nav>
}

function BottomItem({ item, active, locked }: { item: (typeof clientNavSections)[number]; active: boolean; locked: boolean }) {
  const Icon = item.icon
  const className = cn("flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-medium transition-colors", locked ? "cursor-not-allowed text-muted-foreground/45" : active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")
  if (!item.path || locked) return <span className={className}>{Icon && <Icon className="h-5 w-5" />}{locked ? <LockKeyhole className="-mt-5 h-3 w-3 translate-x-2 translate-y-1 rounded-full bg-background p-0.5" /> : null}<span className="truncate">{item.label}</span></span>
  return <Link href={item.path} className={className}>{Icon && <Icon className="h-5 w-5" />}<span className="truncate">{item.label}</span></Link>
}

function MoreItem({ item, active, locked, unreadNotifications }: { item: (typeof clientNavSections)[number]; active: boolean; locked: boolean; unreadNotifications: number }) {
  const Icon = item.icon
  const className = cn("relative flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors", locked ? "cursor-not-allowed text-muted-foreground/45" : active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")
  const content = <>{Icon && <Icon className="h-5 w-5" />}{locked && <LockKeyhole className="h-3.5 w-3.5" />}<span className="flex-1">{item.label}</span>{unreadNotifications > 0 && <Badge className="rounded-full">{unreadNotifications}</Badge>}</>
  if (!item.path || locked) return <span className={className}>{content}</span>
  return <Link href={item.path} className={className}>{content}</Link>
}
