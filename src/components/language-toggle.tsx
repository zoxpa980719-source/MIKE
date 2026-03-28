"use client";

import { Languages } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";

export function LanguageToggle({ className }: { className?: string }) {
  const { locale, toggleLocale } = useLanguage();

  return (
    <button
      type="button"
      onClick={toggleLocale}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-full border border-zinc-200 bg-white/90 px-3 text-sm font-semibold text-zinc-800 transition hover:bg-white dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-100 dark:hover:bg-zinc-900",
        className
      )}
      aria-label="Toggle language"
      title="Toggle language"
    >
      <Languages className="h-4 w-4" />
      <span>{locale === "zh" ? "中/EN" : "EN/中"}</span>
    </button>
  );
}

