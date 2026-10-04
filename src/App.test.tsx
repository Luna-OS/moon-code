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
    // The last known limits first, then the live numbers from Claude Code's /usage.
    expect(await within(claude).findByText("44 %")).toBeInTheDocument();
    expect(within(claude).getByText("79 %")).toBeInTheDocument();
    expect(screen.getByText("5h 44 %")).toBeInTheDocument();
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

  it("signs in to GitHub in a terminal and shows the account", async () => {
    const bridge = new DemoBridge();
    bridge.signOutOfGitHub();
    const start = vi.spyOn(bridge, "terminalStart");
    const user = userEvent.setup();
    render(<App bridge={bridge} />);
    await user.click(await screen.findByRole("button", { name: "Cloud" }));
    await user.click(await screen.findByRole("button", { name: /Sign in with GitHub/ }));
    await waitFor(() =>
      expect(start.mock.calls.some(([, o]) => String(o.command).includes("auth,login"))).toBe(true),
    );
    expect(await screen.findByText("@Luna-OS", undefined, { timeout: 6000 })).toBeInTheDocument();
  });

  it("hands a task to Claude in the cloud", async () => {
    const bridge = new DemoBridge();
    const start = vi.spyOn(bridge, "terminalStart");
    const user = userEvent.setup();
    render(<App bridge={bridge} />);
    await user.click(await screen.findByRole("button", { name: "Cloud" }));
    expect(await screen.findByText("Repository: Luna-OS/Moon-Zip")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Cloud task"), "Add dark mode to the installer");
    await user.click(screen.getByRole("button", { name: /Start in the cloud/ }));
    await waitFor(() => {
      const call = start.mock.calls.find(
        ([, o]) => Array.isArray(o.command) && o.command.includes("--cloud"),
      );
      expect(call?.[1].command).toEqual([
        "/home/luna/.local/bin/claude",
        "--cloud",
        "Add dark mode to the installer",
      ]);
    });
    expect(await screen.findByText("Add dark mode to the installer")).toBeInTheDocument();
  });

  it("Axo works while Claude works, and cheers when it is done", async () => {
    const user = userEvent.setup();
    render(<App bridge={new DemoBridge()} />);
    expect(
      await screen.findByRole("img", { name: /Axo the axolotl is waiting/ }),
    ).toBeInTheDocument();
    await user.type(await screen.findByLabelText("Message to Claude"), "Hi{Enter}");
    expect(
      (await screen.findAllByRole("img", { name: /coding with Claude/ })).length,
    ).toBeGreaterThan(0);
    expect(await screen.findByRole("img", { name: /happy: Claude is done/ })).toBeInTheDocument();
  });

  it("Axo sleeps until you sign in", async () => {
    const bridge = new DemoBridge();
    await bridge.claudeLogout();
    render(<App bridge={bridge} />);
    expect(await screen.findByRole("img", { name: /asleep/ })).toBeInTheDocument();
  });

  it("starts a cloud task on another of your repositories, cloned first", async () => {
    const bridge = new DemoBridge();
    const start = vi.spyOn(bridge, "terminalStart");
    const user = userEvent.setup();
    render(<App bridge={bridge} />);
    await user.click(await screen.findByRole("button", { name: "Cloud" }));
    const list = await screen.findByRole("radiogroup", { name: "Repository for the cloud task" });
    // The open folder's repository is picked to begin with.
    expect(within(list).getByRole("radio", { name: /Moon-Zip/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await user.click(within(list).getByRole("radio", { name: /Moon-Explorer/ }));
    expect(screen.getByText("Repository: Luna-OS/Moon-Explorer")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Cloud task"), "Add a grid view");
    await user.click(screen.getByRole("button", { name: /Start in the cloud/ }));
    await waitFor(() => {
      const call = start.mock.calls.find(
        ([, o]) => Array.isArray(o.command) && o.command.includes("--cloud"),
      );
      expect(call?.[1].cwd).toBe("/home/luna/Moon Code Projects/Moon-Explorer");
    });
    expect(bridge.cloned).toEqual(["Moon-Explorer"]);
  });

  it("opens the new cloud session in Moon Code's cloud tab, not elsewhere", async () => {
    const bridge = new DemoBridge();
    const external = vi.spyOn(bridge, "openExternal");
    const user = userEvent.setup();
    render(<App bridge={bridge} />);
    await user.click(await screen.findByRole("button", { name: "Cloud" }));
    await user.type(await screen.findByLabelText("Cloud task"), "Add a changelog");
    await user.click(screen.getByRole("button", { name: /Start in the cloud/ }));
    const tab = await screen.findByRole("tab", { name: /Cloud/ });
    expect(tab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Address")).toHaveTextContent(
      "claude.ai/code/session_01DemoCloudTask",
    );
    expect(external).not.toHaveBeenCalled();
    // The task remembers its session, so it can be messaged and brought here later.
    await waitFor(() =>
      expect(
        screen.getByRole("group", { name: "Session session_01DemoCloudTask" }),
      ).toBeInTheDocument(),
    );
    const saved = await bridge.getSettings();
    expect(saved.cloudTasks[0]).toMatchObject({
      task: "Add a changelog",
      sessionId: "session_01DemoCloudTask",
    });
    // Closing the tab brings the editor back.
    await user.click(screen.getByRole("button", { name: "Close Cloud" }));
    expect(screen.queryByRole("tab", { name: /Cloud/ })).not.toBeInTheDocument();
  });

  it("messages a cloud session and brings it here", async () => {
    const bridge = new DemoBridge();
    const start = vi.spyOn(bridge, "terminalStart");
    const user = userEvent.setup();
    render(<App bridge={bridge} />);
    await user.click(await screen.findByRole("button", { name: "Cloud" }));
    const session = await screen.findByRole("group", {
      name: "Session session_01MoonZipProgressBar",
    });
    await user.click(within(session).getByRole("button", { name: /Message/ }));
    await user.type(
      screen.getByLabelText("Message for the cloud session"),
      "Also show the percentage",
    );
    await user.click(screen.getByRole("button", { name: "Send to the cloud session" }));
    expect(await screen.findByText(/Sent – Claude picks it up/)).toBeInTheDocument();
    expect(bridge.sent).toEqual([
      { ref: "session_01MoonZipProgressBar", message: "Also show the percentage" },
    ]);

    await user.click(within(session).getByRole("button", { name: /Bring here/ }));
    await waitFor(() => {
      const call = start.mock.calls.find(
        ([, o]) => Array.isArray(o.command) && o.command.includes("--teleport"),
      );
      expect(call?.[1].command).toEqual([
        "/home/luna/.local/bin/claude",
        "--teleport",
        "session_01MoonZipProgressBar",
      ]);
    });
  });

  it("opens a pasted session link in the cloud tab", async () => {
    const user = userEvent.setup();
    render(<App bridge={new DemoBridge()} />);
    await user.click(await screen.findByRole("button", { name: "Cloud" }));
    const field = await screen.findByLabelText("Cloud session link or ID");
    await user.type(field, "nonsense");
    expect(screen.getByText(/isn't a session link/)).toBeInTheDocument();
    await user.clear(field);
    await user.type(field, "claude.ai/code/session_01PastedLink?x=1");
    await user.click(
      within(screen.getByRole("group", { name: "Session session_01PastedLink" })).getByRole(
        "button",
        { name: /Open here/ },
      ),
    );
    expect(await screen.findByLabelText("Address")).toHaveTextContent(
      "claude.ai/code/session_01PastedLink",
    );
  });

  it("shows the usage from the account menu, and keeps it up to date by itself", async () => {
    const bridge = new DemoBridge();
    const user = userEvent.setup();
    render(<App bridge={bridge} />);
    await user.click(await screen.findByRole("button", { name: "Claude account" }));
    const menu = screen.getByRole("menu", { name: "Claude account" });
    await user.click(within(menu).getByRole("menuitem", { name: "Usage" }));
    expect(screen.queryByRole("menu", { name: "Claude account" })).not.toBeInTheDocument();
    expect(await screen.findByRole("tab", { name: /Usage/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(await screen.findByText("Current session")).toBeInTheDocument();
    expect(screen.getByText("This week")).toBeInTheDocument();
    expect(screen.getByText("This week · Sonnet")).toBeInTheDocument();
    expect(screen.getByText("79 % used")).toBeInTheDocument();
    // 79 % with half the week to go runs out early: the warning says so.
    expect(screen.getByText(/at this pace you'll run out/)).toBeInTheDocument();
    expect(screen.getByText(/€0.00 of €40.00/)).toBeInTheDocument();
    // The current session (the first row) creeps up in the demo each time it is asked for.
    const session = Number.parseInt(screen.getAllByText(/ % used$/)[0].textContent ?? "", 10);
    expect(session).toBeGreaterThanOrEqual(44);
    // No refresh button: the numbers come again on their own (here: Moon Code comes back to the
    // front).
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(await screen.findByText(`${session + 1} % used`)).toBeInTheDocument();
    expect(bridge.usageCalls).toBeGreaterThanOrEqual(2);
    // Buying more opens claude.ai's page inside Moon Code.
    await user.click(screen.getByRole("button", { name: "Buy more usage" }));
    expect(await screen.findByLabelText("Address")).toHaveTextContent("claude.ai/settings/usage");
    expect(screen.getByRole("tab", { name: /claude\.ai/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("sets the language Claude answers in", async () => {
    const bridge = new DemoBridge();
    const start = vi.spyOn(bridge, "claudeStart");
    const user = userEvent.setup();
    render(<App bridge={bridge} />);
    await user.click(await screen.findByRole("button", { name: "Claude account" }));
    await user.click(screen.getByRole("menuitem", { name: /Claude's language/ }));
    await user.click(screen.getByRole("menuitemradio", { name: "German" }));
    expect(await screen.findByText(/Claude answers in German/)).toBeInTheDocument();
    expect((await bridge.getSettings()).claudeLanguage).toBe("German");
    await user.type(await screen.findByLabelText("Message to Claude"), "Hi{Enter}");
    await waitFor(() => expect(start.mock.calls.at(-1)?.[1].language).toBe("German"));
  });

  it("+ starts a new conversation, and the last one can be picked again", async () => {
    const user = userEvent.setup();
    render(<App bridge={new DemoBridge()} />);
    await user.type(await screen.findByLabelText("Message to Claude"), "Hi{Enter}");
    expect(
      await screen.findByText(/Want me to wire it up/, undefined, { timeout: 4000 }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "New conversation" }));
    expect(screen.queryByText(/Want me to wire it up/)).not.toBeInTheDocument();
    expect(screen.getByText(/The last one is under Earlier conversations/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Message to Claude")).toHaveFocus());

    await user.click(screen.getByRole("button", { name: "Earlier conversations" }));
    const list = screen.getByRole("menu", { name: "Earlier conversations" });
    await user.click(
      await within(list).findByRole("menuitem", { name: /Add a night theme to the installer/ }),
    );
    expect(await screen.findByText(/Continuing "Add a night theme/)).toBeInTheDocument();
  });

  it("lists, makes, installs and uses skills", async () => {
    const bridge = new DemoBridge();
    const user = userEvent.setup();
    render(<App bridge={bridge} />);
    await user.click(await screen.findByRole("button", { name: "Skills" }));
    const personal = await screen.findByRole("region", { name: "Personal" });
    expect(await within(personal).findByText("replica-recon")).toBeInTheDocument();

    await user.type(screen.getByLabelText("GitHub repository with skills"), "anthropics/skills");
    await user.click(screen.getByRole("button", { name: /^Install$/ }));
    expect(await screen.findByText("Installed the skill skills.")).toBeInTheDocument();
    expect(await within(personal).findByText("skills")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "New skill" }));
    await user.type(screen.getByLabelText("Skill name"), "Release notes");
    await user.type(screen.getByLabelText("Skill description"), "Writes the release notes");
    await user.click(screen.getByRole("button", { name: "Create and edit" }));
    expect(
      await screen.findByLabelText("Editor /home/luna/.claude/skills/release-notes/SKILL.md"),
    ).toBeInTheDocument();

    await user.click(
      within(screen.getByRole("group", { name: "Skill moon-theme" })).getByRole("button", {
        name: "Use",
      }),
    );
    expect(await screen.findByLabelText("Message to Claude")).toHaveValue("/moon-theme ");
  });

  it("sends pictures and files to Claude", async () => {
    const bridge = new DemoBridge();
    const user = userEvent.setup();
    render(<App bridge={bridge} />);
    await screen.findByLabelText("Message to Claude");
    const picture = new File([new Uint8Array([137, 80, 78, 71])], "screen.png", {
      type: "image/png",
    });
    const notes = new File(["the plan"], "plan.md", { type: "text/markdown" });
    await user.upload(screen.getByLabelText("Choose files for Claude"), [picture, notes]);
    const list = await screen.findByRole("list", { name: "Attached files" });
    expect(within(list).getByText("screen.png")).toBeInTheDocument();
    expect(within(list).getByText("plan.md")).toBeInTheDocument();
    await user.click(within(list).getByRole("button", { name: "Remove plan.md" }));
    // A file alone (no text) can be sent too.
    await user.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() =>
      expect(bridge.lastFiles.map((f) => [f.name, f.mime])).toEqual([["screen.png", "image/png"]]),
    );
    expect(bridge.lastFiles[0].data).toBe("iVBORw==");
    expect(await screen.findByRole("img", { name: "screen.png" })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Attached files" })).not.toBeInTheDocument();
  });

  it("merges a pull request Claude made in the cloud", async () => {
    const bridge = new DemoBridge();
    const user = userEvent.setup();
    render(<App bridge={bridge} />);
    await user.click(await screen.findByRole("button", { name: "Cloud" }));
    const pr = await screen.findByRole("group", { name: "Pull request 12" });
    expect(screen.getByText("#12 Add a progress bar to the extract dialog")).toBeInTheDocument();
    expect(screen.getByText("checks pass")).toBeInTheDocument();
    await user.click(within(pr).getByRole("button", { name: "Merge" }));
    expect(
      await screen.findByText("No open pull requests from Claude in Luna-OS/Moon-Zip."),
    ).toBeInTheDocument();
    expect(bridge.merged).toEqual([12]);
  });

  it("finds, downloads and installs an update from Settings", async () => {
    const bridge = new DemoBridge();
    const install = vi.spyOn(bridge, "updateInstall");
    const user = userEvent.setup();
    render(<App bridge={bridge} />);
    await user.click(await screen.findByRole("button", { name: "Settings" }));
    const updates = await screen.findByRole("region", { name: "Updates" });
    expect(within(updates).getByText(/Moon Code 0\.1\.0/)).toBeInTheDocument();
    await user.click(within(updates).getByRole("button", { name: /Check for updates/ }));
    expect(await within(updates).findByText("Moon Code 0.2.0 is out.")).toBeInTheDocument();
    await user.click(within(updates).getByRole("button", { name: /Download 0\.2\.0/ }));
    await user.click(await within(updates).findByRole("button", { name: /Restart and update/ }));
    expect(install).toHaveBeenCalled();
  });
});
