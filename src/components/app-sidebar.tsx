"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import {
  IconCamera,
  IconChartBar,
  IconDashboard,
  IconDatabase,
  IconFileAi,
  IconFileDescription,
  IconFileWord,
  IconFolder,
  IconHelp,
  IconInnerShadowTop,
  IconListDetails,
  IconReport,
  IconSearch,
  IconSettings,
  IconUsers,
} from "@tabler/icons-react"

import { NavDocuments } from "@/components/nav-documents"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  navClouds: [
    {
      title: "Capture",
      icon: IconCamera,
      isActive: true,
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
    {
      title: "Proposal",
      icon: IconFileDescription,
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
    {
      title: "Prompts",
      icon: IconFileAi,
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
  ],
  navSecondary: [
    {
      title: "Settings",
      url: "#",
      icon: IconSettings,
    },
    {
      title: "Get Help",
      url: "#",
      icon: IconHelp,
    },
    {
      title: "Search",
      url: "#",
      icon: IconSearch,
    },
  ],
  documents: [
    {
      name: "Data Library",
      url: "#",
      icon: IconDatabase,
    },
    {
      name: "Reports",
      url: "#",
      icon: IconReport,
    },
    {
      name: "Word Assistant",
      url: "#",
      icon: IconFileWord,
    },
  ],
}

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  currentLine?: string
}

export function AppSidebar({ currentLine, ...props }: AppSidebarProps) {
  const pathname = usePathname()

  const activeLine = React.useMemo(() => {
    if (!pathname) return null
    const segments = pathname.split("/").filter(Boolean)
    if (segments.length === 0) return currentLine ?? null
    try {
      return decodeURIComponent(segments[0])
    } catch {
      return segments[0]
    }
  }, [pathname, currentLine])

  const navMainItems = React.useMemo(() => {
    const line = activeLine ?? currentLine ?? ""
    return [
      {
        title: "Dashboard",
        url: line ? `/${encodeURIComponent(line)}/dashboard` : "#",
        icon: IconDashboard,
      },
      {
        title: "Lifecycle",
        url: line ? `/${encodeURIComponent(line)}/lifecycle` : "#",
        icon: IconListDetails,
      },
      {
        title: "Analytics",
        url: line ? `/${encodeURIComponent(line)}/analytics` : "#",
        icon: IconChartBar,
      },
      {
        title: "Projects",
        url: line ? `/${encodeURIComponent(line)}/projects` : "#",
        icon: IconFolder,
      },
      {
        title: "Team",
        url: line ? `/${encodeURIComponent(line)}/team` : "#",
        icon: IconUsers,
      },
    ]
  }, [activeLine, currentLine])

  const displayLine = activeLine ?? currentLine ?? "Line Dashboard"
  const homeHref =
    displayLine && displayLine !== "Line Dashboard"
      ? `/${encodeURIComponent(displayLine)}/dashboard`
      : "#"

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <a href={homeHref}>
                <IconInnerShadowTop className="!size-5" />
                <span className="text-base font-semibold">
                  {displayLine}
                </span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMainItems} />
        <NavDocuments items={data.documents} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
