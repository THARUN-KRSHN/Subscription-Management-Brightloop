"use client";
import { useEffect, useState } from "react";

type Theme = "light" | "dark";
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);
  useEffect(() => {
    const stored = (localStorage.getItem("theme") as Theme | null) || null;
    if (stored) {
      document.documentElement.setAttribute("data-theme", stored);
      setTheme(stored);
    } else {
      setTheme(null);
    }
  }, []);
  function toggle() {
    const next: Theme = (theme ?? (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? "dark" : "light")) === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    setTheme(next);
  }
  return (
    <button onClick={toggle} className="rounded-[10px] border px-3 py-1.5 text-xs" aria-label="Toggle theme">
      {theme === "dark" ? "Dark" : theme === "light" ? "Light" : "Auto"}
    </button>
  );
}
