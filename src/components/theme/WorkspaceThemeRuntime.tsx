import { useEffect } from "react";
import { useWorkspaceSettings } from "@/hooks/useProjects";

const fontMap: Record<string, string> = {
  inter: "Inter, system-ui, -apple-system, sans-serif",
  serif: "Georgia, Times New Roman, serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
  handwritten: "Comic Sans MS, Bradley Hand, Segoe Print, cursive",
};

export default function WorkspaceThemeRuntime() {
  const { data: settings } = useWorkspaceSettings();

  useEffect(() => {
    if (!settings) return;
    const appearance = settings.appearance as any;
    const root = document.documentElement;
    const fontCss = appearance.fontCss || fontMap[appearance.fontFamily] || fontMap.inter;
    root.style.setProperty("--workspace-font-family", fontCss);
    document.body.style.fontFamily = fontCss;

    if (appearance.primaryColor) root.style.setProperty("--primary", String(appearance.primaryColor));
    if (appearance.accentColor) root.style.setProperty("--accent", String(appearance.accentColor));
  }, [settings]);

  useEffect(() => {
    const handler = (event: Event) => {
      const appearance = (event as CustomEvent).detail ?? {};
      const fontCss = appearance.fontCss || fontMap[appearance.fontFamily] || fontMap.inter;
      document.documentElement.style.setProperty("--workspace-font-family", fontCss);
      document.body.style.fontFamily = fontCss;
      if (appearance.primaryColor) document.documentElement.style.setProperty("--primary", String(appearance.primaryColor));
      if (appearance.accentColor) document.documentElement.style.setProperty("--accent", String(appearance.accentColor));
    };
    window.addEventListener("workspace-theme-changed", handler);
    return () => window.removeEventListener("workspace-theme-changed", handler);
  }, []);

  return null;
}
