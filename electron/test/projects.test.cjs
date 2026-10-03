"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  listProjects,
  listSessions,
  parseTranscriptHead,
  projectDirName,
} = require("../claude/projects.cjs");

const line = (o) => JSON.stringify(o);

test("the head of a transcript gives its folder, branch and first prompt", () => {
  const head = [
    line({ type: "queue-operation", operation: "enqueue" }),
    line({
      type: "user",
      cwd: "/work/moon",
      gitBranch: "main",
      message: { role: "user", content: "<command-name>/init</command-name> Fix the   title bar" },
    }),
    '{"type":"assistant","cut off',
  ].join("\n");
  assert.deepEqual(parseTranscriptHead(head), {
    cwd: "/work/moon",
    branch: "main",
    title: "Fix the title bar",
  });
});

test("a custom title wins over the first prompt", () => {
  const head = [
    line({ type: "user", cwd: "/a", message: { content: [{ type: "text", text: "hello" }] } }),
    line({ type: "custom-title", customTitle: "Night theme" }),
  ].join("\n");
  assert.equal(parseTranscriptHead(head).title, "Night theme");
});

test("Claude Code's project folder names", () => {
  assert.equal(projectDirName("/home/user/moon-code"), "-home-user-moon-code");
  assert.equal(projectDirName("C:\\Users\\Luna\\Moon.Zip"), "C--Users-Luna-Moon-Zip");
});

test("projects from transcripts and ~/.claude.json, newest first", async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "moon-claude-"));
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "moon-work-"));
  const a = path.join(work, "alpha");
  const b = path.join(work, "beta");
  fs.mkdirSync(a);
  fs.mkdirSync(b);

  const write = (proj, id, prompt, mtime) => {
    const dir = path.join(home, "projects", projectDirName(proj));
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${id}.jsonl`);
    fs.writeFileSync(file, line({ type: "user", cwd: proj, message: { content: prompt } }) + "\n");
    fs.utimesSync(file, mtime, mtime);
  };
  write(a, "s1", "first", new Date(2026, 0, 1));
  write(a, "s2", "second", new Date(2026, 5, 1));
  write(b, "s3", "other", new Date(2026, 2, 1));

  const gone = path.join(work, "gone");
  const projects = await listProjects(home, { projects: { [gone]: {}, [a]: {} } });
  assert.deepEqual(
    projects.map((p) => [p.name, p.sessionCount, p.exists]),
    [
      ["alpha", 2, true],
      ["beta", 1, true],
      ["gone", 0, false],
    ],
  );

  const sessions = await listSessions(a, home);
  assert.deepEqual(
    sessions.map((s) => [s.id, s.title]),
    [
      ["s2", "second"],
      ["s1", "first"],
    ],
  );
});
