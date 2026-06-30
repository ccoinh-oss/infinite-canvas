"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { navigationTools, type NavigationToolSlug } from "@/constant/navigation-tools";
import { AppConfigModal } from "@/components/layout/app-config-modal";
import { MobileNavDrawer } from "@/components/layout/mobile-nav-drawer";
import { UserStatusActions } from "@/components/layout/user-status-actions";
import { cn } from "@/lib/utils";
import { useState } from "react";

export function AppTopNav() {
    const pathname = usePathname();
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const hideHeader = /^\/canvas\/[^/]+/.test(pathname);
    const slug = pathname.split("/").filter(Boolean)[0];
    const activeToolSlug = navigationTools.some((tool) => tool.slug === slug) ? (slug as NavigationToolSlug) : undefined;

    return (
        <>
            {!hideHeader ? (
                <header className="sticky top-0 z-20 h-16 shrink-0 border-b border-stone-200/60 bg-background/75 backdrop-blur-xl dark:border-white/10 dark:bg-stone-950/70">
                    <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-4 px-5 sm:px-6">
                        <div className="flex min-w-0 items-center">
                            <Link href="/" className="flex shrink-0 items-center gap-2 rounded-full px-1.5 py-1 text-sm font-medium leading-none tracking-tight text-stone-900 transition hover:text-stone-600 dark:text-stone-100 dark:hover:text-stone-300">
                                <img src="/logo.png" alt="BMCCA无限画布" className="size-7 shrink-0 rounded-md object-contain" />
                                <span className="hidden text-[15px] font-medium sm:inline">BMCCA无限画布</span>
                            </Link>

                            <button
                                type="button"
                                className="ml-2 inline-flex size-8 shrink-0 items-center justify-center rounded-full text-stone-500 transition hover:bg-stone-950/[0.05] hover:text-stone-950 md:hidden dark:text-stone-300 dark:hover:bg-white/10 dark:hover:text-white"
                                onClick={() => setMobileNavOpen(true)}
                                aria-label="打开导航菜单"
                                title="导航菜单"
                            >
                                <Menu className="size-4" />
                            </button>

                            <nav className="hide-scrollbar ml-5 hidden min-w-0 items-center gap-1 overflow-x-auto md:flex">
                                {navigationTools.map((tool) => {
                                    const Icon = tool.icon;
                                    const active = tool.slug === activeToolSlug;
                                    return (
                                        <Link
                                            key={tool.slug}
                                            href={`/${tool.slug}`}
                                            className={cn(
                                                "relative flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm leading-none transition",
                                                active
                                                    ? "bg-stone-950 font-medium text-white shadow-sm shadow-stone-950/10 dark:bg-stone-100 dark:text-stone-950 dark:shadow-none"
                                                    : "text-stone-500 hover:bg-stone-950/[0.05] hover:text-stone-950 dark:text-stone-400 dark:hover:bg-white/10 dark:hover:text-stone-100",
                                            )}
                                        >
                                            <Icon className="size-4" />
                                            <span className="truncate">{tool.label}</span>
                                        </Link>
                                    );
                                })}
                            </nav>
                        </div>

                        <div className="my-auto flex min-w-0 items-center justify-end rounded-full border border-stone-200/70 bg-white/60 px-1.5 py-1 shadow-sm shadow-stone-950/[0.03] backdrop-blur dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
                            <UserStatusActions />
                        </div>
                    </div>
                </header>
            ) : null}

            <MobileNavDrawer open={mobileNavOpen} activeToolSlug={activeToolSlug} onClose={() => setMobileNavOpen(false)} />
            <AppConfigModal />
        </>
    );
}
