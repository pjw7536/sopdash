import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

type SiteHeaderProps = {
  lineId?: string
  lastUpdatedAt?: string | null
}

const updatedFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
})

export function SiteHeader({ lineId, lastUpdatedAt }: SiteHeaderProps) {
  const formattedUpdatedAt =
    lastUpdatedAt && !Number.isNaN(new Date(lastUpdatedAt).getTime())
      ? updatedFormatter.format(new Date(lastUpdatedAt))
      : null

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
          <h1 className="text-base font-semibold">
            {lineId ? `Dashboard · ${lineId}` : "Dashboard"}
          </h1>
          {formattedUpdatedAt ? (
            <span className="text-xs text-muted-foreground">Updated {formattedUpdatedAt}</span>
          ) : null}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" asChild size="sm" className="hidden sm:flex">
            <a
              href="https://github.com/shadcn-ui/ui/tree/main/apps/v4/app/(examples)/dashboard"
              rel="noopener noreferrer"
              target="_blank"
              className="dark:text-foreground"
            >
              GitHub
            </a>
          </Button>
        </div>
      </div>
    </header>
  )
}
