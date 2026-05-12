import Link from "next/link";
import type { Route } from "next";
import { DatabaseZap, FileUp, Gauge, Settings, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems: Array<{ href: Route; label: string; icon: LucideIcon }> = [
  { href: "/", label: "Dashboard", icon: Gauge },
  { href: "/upload", label: "Upload", icon: FileUp },
  { href: "/review", label: "Review", icon: ShieldCheck },
  { href: "/analytics", label: "Analytics", icon: DatabaseZap },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/30">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r bg-background/95 p-6 backdrop-blur lg:block">
        <Link href="/" className="flex items-center gap-3">
          <div className="rounded-2xl bg-primary p-2 text-primary-foreground">
            <DatabaseZap className="size-6" />
          </div>
          <div>
            <p className="text-lg font-semibold">DRMD</p>
            <p className="text-xs text-muted-foreground">Excel & CSV entity resolution</p>
          </div>
        </Link>

        <nav className="mt-10 grid gap-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(buttonVariants({ variant: "ghost" }), "justify-start gap-3")}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <main className="lg:pl-72">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
          <header className="flex flex-col gap-4 rounded-3xl border bg-background p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.3em] text-muted-foreground">
                Production-ready data quality
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                DRMD deduplication workspace
              </h1>
              <p className="mt-2 max-w-3xl text-muted-foreground">
                Parse, normalize, fuzzy-match, cluster, review, merge, and export large CRM,
                employee, voter, and customer lists without sending files to a server.
              </p>
            </div>
            <Link href="/upload" className={buttonVariants()}>
              Upload dataset
            </Link>
          </header>
          {children}
        </div>
      </main>
    </div>
  );
}
