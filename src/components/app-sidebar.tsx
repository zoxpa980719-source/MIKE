"use client";

import React, { useState } from "react";
import {
  Sidebar,
  SidebarBody,
  SidebarLink,
  useSidebar,
} from "@/components/ui/animated-sidebar";
import {
  Briefcase,
  Building2,
  LayoutDashboard,
  User,
  FileText,
  BarChartHorizontal,
  Crown,
  Rocket,
  Kanban,
  MessageSquare,
  Shield,
  Receipt,
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { usePathname } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { ConditionalSearchBar } from "@/components/conditional-search-bar";
import { NotificationsDropdown } from "@/components/notifications-dropdown";
import { UserNav } from "@/components/user-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";

const copy = {
  zh: {
    dashboard: "仪表盘",
    opportunities: "机会",
    applications: "申请",
    plans: "套餐",
    orders: "订单",
    launchPad: "工具箱",
    profile: "个人资料",
    inbox: "消息",
    postings: "职位发布",
    analytics: "分析",
    adminDashboard: "管理后台",
  },
  en: {
    dashboard: "Dashboard",
    opportunities: "Opportunities",
    applications: "Applications",
    plans: "Plans",
    orders: "Orders",
    launchPad: "LaunchPad",
    profile: "Profile",
    inbox: "Inbox",
    postings: "Postings",
    analytics: "Analytics",
    adminDashboard: "Admin Dashboard",
  },
} as const;

export function AppSidebar({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { role, loading } = useAuth();
  const { locale } = useLanguage();
  const pathname = usePathname();
  const t = copy[locale];

  const employeeLinks = [
    {
      label: t.dashboard,
      href: "/dashboard",
      icon: (
        <LayoutDashboard className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
      ),
    },
    {
      label: t.opportunities,
      href: "/opportunities",
      disabled: true,
      icon: (
        <Briefcase className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
      ),
    },
    {
      label: t.applications,
      href: "/applications",
      disabled: true,
      icon: (
        <Kanban className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
      ),
    },
    {
      label: t.plans,
      href: "/pricing",
      disabled: true,
      icon: (
        <Crown className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
      ),
    },
    {
      label: t.orders,
      href: "/orders",
      icon: (
        <Receipt className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
      ),
    },
    {
      label: t.launchPad,
      href: "/ai-tools",
      disabled: true,
      icon: (
        <Rocket className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
      ),
    },
    {
      label: t.profile,
      href: "/profile",
      disabled: true,
      icon: (
        <User className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
      ),
    },
    {
      label: t.inbox,
      href: "/inbox",
      icon: (
        <MessageSquare className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
      ),
    },
  ];

  const employerLinks = [
    {
      label: t.dashboard,
      href: "/employer/dashboard",
      icon: (
        <Building2 className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
      ),
    },
    {
      label: t.postings,
      href: "/employer/postings",
      icon: (
        <FileText className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
      ),
    },
    {
      label: t.analytics,
      href: "/employer/analytics",
      icon: (
        <BarChartHorizontal className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
      ),
    },
    {
      label: t.profile,
      href: "/employer/profile",
      icon: (
        <User className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
      ),
    },
    {
      label: t.orders,
      href: "/orders",
      icon: (
        <Receipt className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
      ),
    },
    {
      label: t.inbox,
      href: "/inbox",
      icon: (
        <MessageSquare className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
      ),
    },
  ];

  const adminLinks = [
    {
      label: t.adminDashboard,
      href: "/admin",
      icon: (
        <Shield className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
      ),
    },
  ];

  const links = role === "admin" ? adminLinks : role === "employer" ? employerLinks : employeeLinks;
  const dashboardHref = role === "admin" ? "/admin" : role === "employer" ? "/employer/dashboard" : "/dashboard";

  if (loading) {
    return (
      <div className="flex h-screen w-full">
        <div className="w-[60px] bg-neutral-100 dark:bg-neutral-800 p-4">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <div className="mt-8 flex flex-col gap-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-5 w-5" />
            ))}
          </div>
        </div>
        <div className="flex-1">{children}</div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col md:flex-row bg-gray-100 dark:bg-neutral-800 w-full flex-1 mx-auto border border-neutral-200 dark:border-neutral-700 overflow-hidden",
        "h-screen"
      )}
    >
      <Sidebar open={open} setOpen={setOpen}>
        <SidebarBody className="justify-between gap-10">
          <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
            {open ? <Logo href={dashboardHref} /> : <LogoIcon href={dashboardHref} />}
            <div className="mt-8 flex flex-col gap-2">
              {links.map((link, idx) => (
                <SidebarLink
                  key={idx}
                  link={link}
                  className={cn(
                    pathname === link.href && "bg-neutral-200 dark:bg-neutral-700 rounded-lg px-2"
                  )}
                />
              ))}
            </div>
          </div>
        </SidebarBody>
      </Sidebar>
      <div className="flex flex-1 flex-col overflow-hidden rounded-l-3xl bg-white dark:bg-neutral-900">
        <header className="sticky top-0 z-10 flex h-10 shrink-0 items-center justify-between gap-4 dark:border-neutral-700 px-4 sm:h-auto sm:px-6 py-2">
          <div className="flex-1" />
          <div className="flex-1 flex justify-center max-w-xl">
            <ConditionalSearchBar />
          </div>
          <div className="flex-1 flex items-center justify-end gap-4">
            <NotificationsDropdown />
            <LanguageToggle />
            <ThemeToggle />
            <UserNav />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

export const Logo = ({ href }: { href: string }) => {
  return (
    <Link
      href={href}
      className="font-normal flex space-x-2 items-center text-sm text-black py-1 relative z-20"
    >
      <Image
        src="https://i.postimg.cc/nLrDYrHW/icon.png"
        alt="YINHNG logo"
        width={24}
        height={24}
        className="dark:bg-white dark:p-0.5 dark:rounded-3xl flex-shrink-0"
      />
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-xl font-extrabold tracking-[0.2em] uppercase text-black dark:text-white whitespace-pre"
      >
        YINHNG
      </motion.span>
    </Link>
  );
};

export const LogoIcon = ({ href }: { href: string }) => {
  return (
    <Link
      href={href}
      className="font-normal flex space-x-2 items-center text-sm text-black py-1 relative z-20"
    >
      <Image
        src="https://i.postimg.cc/nLrDYrHW/icon.png"
        alt="YINHNG logo"
        width={24}
        height={24}
        className="dark:bg-white dark:p-0.5 dark:rounded-3xl flex-shrink-0"
      />
    </Link>
  );
};
