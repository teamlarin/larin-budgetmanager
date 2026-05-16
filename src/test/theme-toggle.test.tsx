import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";

function setup() {
  return render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>
  );
}

describe("ThemeToggle", () => {
  beforeEach(() => {
    document.documentElement.classList.remove("dark", "light");
    localStorage.clear();
  });

  it("toggles the dark class on <html> when switching theme", async () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /cambia tema/i }));
    fireEvent.click(await screen.findByText(/scuro/i));

    expect(document.documentElement.classList.contains("dark")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: /cambia tema/i }));
    fireEvent.click(await screen.findByText(/chiaro/i));

    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("persists theme choice to localStorage", async () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /cambia tema/i }));
    fireEvent.click(await screen.findByText(/scuro/i));
    expect(localStorage.getItem("theme")).toBe("dark");
  });
});
