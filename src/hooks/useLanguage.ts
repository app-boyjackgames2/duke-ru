import { useState, useEffect } from "react";
import type { Lang } from "@/i18n/translations";

function detectLang(): Lang {
  const stored = localStorage.getItem("duke-lang");
  if (stored === "en" || stored === "ru") return stored;
  const nav = navigator.language?.toLowerCase() || "";
  return nav.startsWith("ru") ? "ru" : "en";
}

export function useLanguage() {
  const [lang, setLangState] = useState<Lang>(detectLang);

  const setLang = (l: Lang) => {
    localStorage.setItem("duke-lang", l);
    setLangState(l);
  };

  useEffect(() => {
    // sync across tabs
    const handler = () => setLangState(detectLang());
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  return { lang, setLang };
}
