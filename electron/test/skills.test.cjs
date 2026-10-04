"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const skills = require("../claude/skills.cjs");

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "mc-skills-"));
const write = (file, text) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
};

test("front matter: plain, quoted and folded descriptions", () => {
  assert.deepEqual(skills.parseFrontMatter("---\nname: pdf\ndescription: 'Read PDFs'\n---\n# x"), {
    name: "pdf",
    description: "Read PDFs",
  });
  assert.deepEqual(
    skills.parseFrontMatter("---\r\nname: a\r\ndescription: >-\r\n  Two\r\n  lines\r\n---\r\n"),
    { name: "a", description: "Two lines" },
  );
  assert.deepEqual(skills.parseFrontMatter("# no front matter"), {});
});

test("lists the project's skills and the personal ones", () => {
  const home = tmp();
  const project = tmp();
  write(
    path.join(home, "skills", "b-skill", "SKILL.md"),
    "---\nname: b-skill\ndescription: B\n---\n",
  );
  write(path.join(home, "skills", "a-skill", "SKILL.md"), "---\ndescription: A\n---\n");
  write(path.join(home, "skills", "not-a-skill", "README.md"), "x");
  write(path.join(project, ".claude", "skills", "deploy", "SKILL.md"), "---\nname: deploy\n---\n");
  const list = skills.listSkills(project, home);
  assert.deepEqual(
    list.map((s) => [s.scope, s.name, s.description]),
    [
      ["project", "deploy", ""],
      ["personal", "a-skill", "A"],
      ["personal", "b-skill", "B"],
    ],
  );
  assert.deepEqual(skills.listSkills(null, tmp()), []);
});

test("creates a skill with a SKILL.md to fill in, once", () => {
  const home = tmp();
  const file = skills.createSkill(
    { name: "Release Notes!", description: "Writes release notes", scope: "personal" },
    home,
  );
  assert.equal(file, path.join(home, "skills", "release-notes", "SKILL.md"));
  assert.match(
    fs.readFileSync(file, "utf8"),
    /^---\nname: release-notes\ndescription: Writes release notes\n---/,
  );
  assert.throws(
    () => skills.createSkill({ name: "release notes", scope: "personal" }, home),
    /already exists/,
  );
  assert.throws(
    () => skills.createSkill({ name: "x", scope: "project", project: null }, home),
    /Open a folder/,
  );
  assert.throws(() => skills.createSkill({ name: "!!", scope: "personal" }, home), /name/);
});

test("GitHub repositories by owner/name or link", () => {
  assert.deepEqual(skills.gitUrl("Jakeschincariol/replica-skill"), {
    url: "https://github.com/Jakeschincariol/replica-skill.git",
    name: "replica-skill",
  });
  assert.deepEqual(skills.gitUrl("https://github.com/anthropics/skills/tree/main/pdf"), {
    url: "https://github.com/anthropics/skills.git",
    name: "skills",
  });
  assert.equal(skills.gitUrl("https://example.com/x/y"), null);
  assert.equal(skills.gitUrl("rm -rf"), null);
});

test("installs every folder with a SKILL.md from a repository", async () => {
  const home = tmp();
  const fakeClone = async (_url, target) => {
    write(
      path.join(target, ".claude", "skills", "replica-recon", "SKILL.md"),
      "---\nname: replica-recon\n---\n",
    );
    write(
      path.join(target, ".claude", "skills", "replica-test", "SKILL.md"),
      "---\nname: replica-test\n---\n",
    );
    write(path.join(target, ".claude", "skills", "replica-test", "scripts", "run.py"), "print(1)");
    write(path.join(target, ".git", "HEAD"), "ref");
    write(path.join(target, "README.md"), "x");
  };
  const installed = await skills.installFromGitHub("Jakeschincariol/replica-skill", {
    home,
    clone: fakeClone,
  });
  assert.deepEqual(installed.sort(), ["replica-recon", "replica-test"]);
  assert.ok(fs.existsSync(path.join(home, "skills", "replica-test", "scripts", "run.py")));

  // A repository that is one skill.
  const single = await skills.installFromGitHub("someone/My-Skill", {
    home,
    clone: async (_u, t) => write(path.join(t, "SKILL.md"), "---\nname: mine\n---\n"),
  });
  assert.deepEqual(single, ["my-skill"]);
  await assert.rejects(
    skills.installFromGitHub("someone/empty", {
      home,
      clone: async (_u, t) => write(path.join(t, "a.txt"), ""),
    }),
    /no SKILL.md/,
  );
});

test("only skill folders may be removed", () => {
  const home = tmp();
  const dir = path.join(home, "skills", "x");
  assert.equal(skills.skillFolder(dir, null, home), dir);
  assert.throws(() => skills.skillFolder(home, null, home), /isn't a skill folder/);
  assert.throws(
    () => skills.skillFolder(path.join(dir, "deeper"), null, home),
    /isn't a skill folder/,
  );
});
