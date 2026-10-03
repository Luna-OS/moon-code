import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "./App";
import { DemoBridge } from "./lib/demo";
import type { MoonCodeBridge } from "./lib/types";

// Monaco and xterm need a real browser; the tests use stand-ins with the same props.
vi.mock("./workbench/CodeEditor", () => ({
  default: ({ path, text }: { path: string; text: string }) => (
    <textarea aria-label={`Editor ${path}`} defaultValue={text} />
  ),
}));
vi.mock("./workbench/monaco-models", () => ({ disposeModel: () => {} }));
vi.mock("./workbench/TerminalView", async () => {
  const { useEffect } = await import("react");
  return {
    default: function FakeTerminal({
      bridge,
      id,
      cwd,
      command,
    }: {
      bridge: MoonCodeBridge;
      id: string;
      cwd: string | null;
      command?: string[] | string;
    }) {
      useEffect(() => {
        void bridge.terminalStart(id, { cwd, cols: 80, rows: 24, command });
      }, [bridge, id, cwd, command]);
      return <div data-testid={`terminal-${id}`} />;
    },
  };
});

describe("Moon Code", () => {
  it("opens the last folder with Claude signed in, the limits and the model", async () => {
    render(<App bridge={new DemoBridge()} />);
    expect(await screen.findByRole("treeitem", { name: "README.md" })).toBeInTheDocument();
    const claude = await screen.findByRole("complementary", { name: "Claude" });
    expect(await within(claude).findByText("luna@example.com")).toBeInTheDocument();
    expect(within(claude).getByText("Max")).toBeInTheDocument();
    expect(within(claude).getByText("48 %")).toBeInTheDocument();
    expect(within(claude).getByText("66 %")).toBeInTheDocument();
    expect(screen.getByText("5h 48 %")).toBeInTheDocument();
  });

  it("opens a file in a tab", async () => {
    const user = userEvent.setup();
    render(<App bridge={new DemoBridge()} />);
    await user.click(await screen.findByRole("treeitem", { name: "src" }));
    await user.click(await screen.findByRole("treeitem", { name: "App.tsx" }));
    expect(
      await screen.findByLabelText("Editor /home/luna/Moon-Zip/src/App.tsx"),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /App\.tsx/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
  });

  it("talks to Claude: the answer, the tool card, the model and the context", async () => {
    const user = userEvent.setup();
    render(<App bridge={new DemoBridge()} />);
    const box = await screen.findByLabelText("Message to Claude");
    await user.type(box, "Explain the start page{Enter}");
    expect(screen.getByText("Explain the start page")).toBeInTheDocument();
    expect(await screen.findByText(/Want me to wire it up\?/)).toBeInTheDocument();
    expect(screen.getByText("Read")).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText(/Opus 5\.5/).length).toBeGreaterThan(0));
    expect(screen.getByText(/Context 18k \/ 200k/)).toBeInTheDocument();
  });

  it("lists the Claude projects and the GitHub repositories", async () => {
    const user = userEvent.setup();
    render(<App bridge={new DemoBridge()} />);
    await user.click(await screen.findByRole("button", { name: /^Projects$/ }));
    expect(await screen.findByText(/~\/Moon-Explorer · 5 h ago/)).toBeInTheDocument();
    expect(await screen.findByText("moon-code")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Conversations in Moon-Zip" }));
    expect(await screen.findByText("Add a night theme to the installer")).toBeInTheDocument();
  });

  it("asks to sign in when Claude Code isn't signed in", async () => {
    const bridge = new DemoBridge();
    await bridge.claudeLogout();
    const user = userEvent.setup();
    render(<App bridge={bridge} />);
    const claude = await screen.findByRole("complementary", { name: "Claude" });
    await user.click(await within(claude).findByRole("button", { name: "Sign in with Claude" }));
    // The sign-in runs in a terminal; the account shows up as soon as it is done.
    expect(await screen.findByTestId("terminal-term-1")).toBeInTheDocument();
    expect(
      await within(claude).findByText("luna@example.com", undefined, { timeout: 6000 }),
    ).toBeInTheDocument();
  });

  it("switches night and day", async () => {
    const user = userEvent.setup();
    render(<App bridge={new DemoBridge()} />);
    await user.click(await screen.findByRole("button", { name: "Switch to the day theme" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    await act(async () => {});
  });

  it("finds files with Ctrl+P", async () => {
    const user = userEvent.setup();
    render(<App bridge={new DemoBridge()} />);
    await screen.findByRole("treeitem", { name: "README.md" });
    await user.keyboard("{Control>}p{/Control}");
    await user.keyboard("format");
    await user.keyboard("{Enter}");
    expect(
      await screen.findByLabelText("Editor /home/luna/Moon-Zip/src/lib/format.ts"),
    ).toBeInTheDocument();
  });
});
