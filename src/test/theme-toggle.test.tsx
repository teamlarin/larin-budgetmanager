import { describe, it, expect, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useTheme } from "next-themes";

function Harness({ onReady }: { onReady: (api: ReturnType<typeof useTheme>) => void }) {
  const api = useTheme();
  onReady(api);
  return null;
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    document.documentElement.classList.remove("dark", "light");
    localStorage.clear();
  });

  it("applies the .dark class to <html> when theme is set to dark", () => {
    let api!: ReturnType<typeof useTheme>;
    render(
      <ThemeProvider>
        <Harness onReady={(a) => (api = a)} />
      </ThemeProvider>
    );

    act(() => api.setTheme("dark"));
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    act(() => api.setTheme("light"));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("persists the chosen theme to localStorage", () => {
    let api!: ReturnType<typeof useTheme>;
    render(
      <ThemeProvider>
        <Harness onReady={(a) => (api = a)} />
      </ThemeProvider>
    );

    act(() => api.setTheme("dark"));
    expect(localStorage.getItem("theme")).toBe("dark");
  });
});
