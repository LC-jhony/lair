import type * as React from 'react'
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react'
import { cn } from '@/lib/utils'

export const Tabs = TabGroup

export function TabsList({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <TabList
      className={cn(
        'inline-flex items-center gap-1 rounded-lg border bg-muted/60 p-1 text-sm',
        className,
      )}
    >
      {children}
    </TabList>
  )
}

export function TabsTrigger({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <Tab
      className={cn(
        'rounded-md px-3 py-1 text-muted-foreground transition-colors',
        'hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'data-selected:bg-background data-selected:text-foreground data-selected:shadow-sm',
        className,
      )}
    >
      {children}
    </Tab>
  )
}

export function TabsContent({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <TabPanels className={className}>{children}</TabPanels>
}

export function TabsPanel({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <TabPanel className={cn('pt-4 focus-visible:outline-none', className)}>{children}</TabPanel>
}
