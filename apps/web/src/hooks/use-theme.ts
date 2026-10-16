import { useContext } from "react";
import { ThemeContext } from "@/providers/theme";

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === null) {
    throw new Error("Theme controls require a ThemeProvider.");
  }
  return context;
}
