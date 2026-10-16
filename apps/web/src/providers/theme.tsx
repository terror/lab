import {
  createContext,
  type ReactNode,
  useLayoutEffect,
  useState,
} from "react";

type Theme = "light" | "dark" | "system";

export const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
} | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem("lab.theme.v1");
      return saved === "light" || saved === "dark" ? saved : "system";
    } catch {
      return "system";
    }
  });

  useLayoutEffect(() => {
    const preference = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark =
        theme === "dark" || (theme === "system" && preference.matches);
      document.documentElement.classList.toggle("dark", dark);
      document.documentElement.style.colorScheme = dark ? "dark" : "light";
    };

    apply();
    preference.addEventListener("change", apply);
    return () => preference.removeEventListener("change", apply);
  }, [theme]);

  return (
    <ThemeContext
      value={{
        theme,
        setTheme: (theme) => {
          setTheme(theme);
          try {
            localStorage.setItem("lab.theme.v1", theme);
          } catch {
            return;
          }
        },
      }}
    >
      {children}
    </ThemeContext>
  );
}
