"use client";

import { useEffect } from "react";
import { useI18n } from "@/lib/i18n";

export function LanguageSwitch() {
  const { locale, setLocale } = useI18n();
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title =
      locale === "zh-CN"
        ? "PULSE — 城市商业机会分析"
        : "PULSE — Urban Opportunity Intelligence";
  }, [locale]);
  return (
    <div
      className="language-switch"
      role="group"
      aria-label="Interface language / 界面语言"
    >
      <button
        type="button"
        lang="en"
        aria-label="English"
        aria-pressed={locale === "en"}
        onClick={() => setLocale("en")}
      >
        EN
      </button>
      <button
        type="button"
        lang="zh-CN"
        aria-label="简体中文"
        aria-pressed={locale === "zh-CN"}
        onClick={() => setLocale("zh-CN")}
      >
        中文
      </button>
    </div>
  );
}
