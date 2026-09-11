"use client";

import { useCallback, useSyncExternalStore } from "react";
import chinese from "./locales/zh-CN.json";

export type Locale = "en" | "zh-CN";
const storageKey = "pulse-language-v1";
const changeEvent = "pulse-language-change";
let memoryLocale: Locale = "en";
const dictionary = new Map(
  Object.entries(chinese).map(([key, value]) => [key.toLowerCase(), value]),
);

function snapshot(): Locale {
  try {
    const saved = window.localStorage.getItem(storageKey);
    if (saved === "en" || saved === "zh-CN") return saved;
  } catch {
    // Language switching still works when persistent storage is unavailable.
  }
  return memoryLocale;
}

function subscribe(notify: () => void) {
  window.addEventListener(changeEvent, notify);
  window.addEventListener("storage", notify);
  return () => {
    window.removeEventListener(changeEvent, notify);
    window.removeEventListener("storage", notify);
  };
}

export function setLocale(locale: Locale) {
  memoryLocale = locale;
  try {
    window.localStorage.setItem(storageKey, locale);
  } catch {
    // Keep the in-memory preference for this session.
  }
  window.dispatchEvent(new Event(changeEvent));
}

/** Translate display text only. Identifiers, source names and API values stay intact. */
export function translate(
  locale: Locale,
  value: string | number | null | undefined,
): string {
  if (value == null) return "";
  const original = String(value);
  if (locale === "en") return original;
  const key = original.trim().replace(/\s+/g, " ");
  let translated = dictionary.get(key.toLowerCase());
  if (!translated) {
    // Translate the server's deterministic explanations without recalculating scores.
    const summary = key.match(
      /^This area is supported by (.+)\. The main constraint is (.+)\.$/,
    );
    const comparison = key.match(
      /^Site A has stronger (.+)\. Site B has stronger (.+)\.$/,
    );
    const list = (text: string) =>
      text
        .split(", ")
        .map((part) => translate(locale, part))
        .join("、");
    if (summary)
      translated = `该区域的主要支持因素是${list(summary[1])}。主要限制是${list(summary[2])}。`;
    else if (comparison)
      translated = `区域 A 较强的方面：${list(comparison[1])}。区域 B 较强的方面：${list(comparison[2])}。`;
    else if (key.startsWith("Inspect ")) translated = `查看 ${key.slice(8)}`;
    else if (/^Choose site [AB]$/.test(key))
      translated = `选择区域 ${key.at(-1)}`;
    else if (key.endsWith(" weight"))
      translated = `${translate(locale, key.slice(0, -7))}权重`;
  }
  if (translated == null) return original;
  return original.match(/^\s*/)?.[0] + translated + original.match(/\s*$/)?.[0];
}

export function formatNumber(
  locale: Locale,
  value: number | null | undefined,
  digits = 0,
) {
  return value == null || !Number.isFinite(value)
    ? translate(locale, "Unavailable")
    : new Intl.NumberFormat(locale === "en" ? "en-GB" : locale, {
        maximumFractionDigits: digits,
      }).format(value);
}

export function formatDate(locale: Locale, value: string | null | undefined) {
  if (!value) return translate(locale, "Not supplied by publisher");
  if (/^\d{4}$/.test(value)) return value;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return translate(locale, "Unavailable");
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : locale, {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function useI18n() {
  // The English server snapshot matches the initial render; saved preferences hydrate safely.
  const locale = useSyncExternalStore(
    subscribe,
    snapshot,
    () => "en" as Locale,
  );
  const t = useCallback(
    (value: string | number | null | undefined) => translate(locale, value),
    [locale],
  );
  const number = useCallback(
    (value: number | null | undefined, digits = 0) =>
      formatNumber(locale, value, digits),
    [locale],
  );
  const date = useCallback(
    (value: string | null | undefined) => formatDate(locale, value),
    [locale],
  );
  const population = useCallback(
    (value: number | null | undefined) =>
      number(value == null ? value : Math.round(value / 100) * 100),
    [number],
  );
  return { locale, setLocale, t, number, date, population };
}
