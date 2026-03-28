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
  const [locale, setLocaleState] = useState<Locale>("zh");

  useEffect(() => {
    const cached = window.localStorage.getItem("site_locale");
    if (cached === "zh" || cached === "en") {
      setLocaleState(cached);
      return;
    }
    const browserPrefersChinese = navigator.language.toLowerCase().startsWith("zh");
    setLocaleState(browserPrefersChinese ? "zh" : "en");
  }, []);

  useEffect(() => {
    window.localStorage.setItem("site_locale", locale);
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  const value = useMemo(
    () => ({
      locale,
      setLocale: (nextLocale: Locale) => setLocaleState(nextLocale),
      toggleLocale: () => setLocaleState((prev) => (prev === "zh" ? "en" : "zh")),
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

