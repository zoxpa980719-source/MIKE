"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Locale = "zh" | "en";

type LanguageContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
};

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const cached = window.localStorage.getItem("site_locale");
    const manuallySelected = window.localStorage.getItem("site_locale_manual") === "1";
    if (cached === "zh" || cached === "en") {
      setLocaleState(manuallySelected ? cached : "en");
      return;
    }
    setLocaleState("en");
  }, []);

  useEffect(() => {
    window.localStorage.setItem("site_locale", locale);
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  const value = useMemo(
    () => ({
      locale,
      setLocale: (nextLocale: Locale) => {
        window.localStorage.setItem("site_locale_manual", "1");
        setLocaleState(nextLocale);
      },
      toggleLocale: () => {
        window.localStorage.setItem("site_locale_manual", "1");
        setLocaleState((prev) => (prev === "zh" ? "en" : "zh"));
      },
    }),
    [locale]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
}
