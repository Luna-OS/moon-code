"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const zlib = require("zlib");
const skills = require("../claude/skills.cjs");
const { extractTarGz } = require("../tar.cjs");

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

test("GitHub repositories by owner/name, link or folder link", () => {
  assert.deepEqual(skills.gitUrl("Jakeschincariol/replica-skill"), {
    owner: "Jakeschincariol",
    repo: "replica-skill",
    name: "replica-skill",
    sub: "",
  });
  assert.deepEqual(skills.gitUrl("https://github.com/anthropics/skills/tree/main/skills/pdf/"), {
    owner: "anthropics",
    repo: "skills",
    name: "skills",
    sub: "skills/pdf",
  });
  assert.deepEqual(skills.gitUrl("https://github.com/a/b.git").repo, "b");
  assert.equal(skills.gitUrl("https://example.com/x/y"), null);
  assert.equal(skills.gitUrl("rm -rf"), null);
});

/** A .tar.gz as GitHub hands it out: everything under "owner-repo-sha/". */
function tarGz(files) {
  const blocks = [];
  const header = (name, size, type) => {
    const h = Buffer.alloc(512);
    h.write(name, 0, 100, "utf8");
    h.write("0000644\0", 100);
    h.write("0000000\0", 108);
    h.write("0000000\0", 116);
    h.write(`${size.toString(8).padStart(11, "0")}\0`, 124);
    h.write("00000000000\0", 136);
    h.write("        ", 148);
    h.write(type, 156);
    h.write("ustar\u000000", 257);
    let sum = 0;
    for (const b of h) sum += b;
    h.write(`${sum.toString(8).padStart(6, "0")}\0 `, 148);
    return h;
  };
  const pad = (n) => Buffer.alloc((512 - (n % 512)) % 512);
  blocks.push(header("o-r-abc123/", 0, "5"));
  for (const [name, text] of Object.entries(files)) {
    const data = Buffer.from(text);
    const full = `o-r-abc123/${name}`;
    if (full.length > 99) {
      const rec = ` path=${full}\n`;
      let len = rec.length;
      len += String(len + String(len).length).length;
      const paxBody = Buffer.from(`${len}${rec}`);
      blocks.push(header("PaxHeader", paxBody.length, "x"), paxBody, pad(paxBody.length));
    }
    blocks.push(header(full.slice(0, 99), data.length, "0"), data, pad(data.length));
  }
  blocks.push(Buffer.alloc(1024));
  return zlib.gzipSync(Buffer.concat(blocks));
}

test("installs every folder with a SKILL.md from a repository's archive", async () => {
  const home = tmp();
  const deep = `.claude/skills/replica-test/${"nested/".repeat(14)}deep.md`;
  const download = async (owner, repo) => {
    assert.deepEqual([owner, repo], ["Jakeschincariol", "replica-skill"]);
    return tarGz({
      ".claude/skills/replica-recon/SKILL.md": "---\nname: replica-recon\n---\n",
      ".claude/skills/replica-test/SKILL.md": "---\nname: replica-test\n---\n",
      ".claude/skills/replica-test/scripts/run.py": "print(1)",
      [deep]: "deep",
      "README.md": "x",
    });
  };
  const installed = await skills.installFromGitHub("Jakeschincariol/replica-skill", {
    home,
    download,
  });
  assert.deepEqual(installed.sort(), ["replica-recon", "replica-test"]);
  assert.equal(
    fs.readFileSync(path.join(home, "skills", "replica-test", "scripts", "run.py"), "utf8"),
    "print(1)",
  );
  assert.ok(fs.existsSync(path.join(home, "skills", ...deep.split("/").slice(2))));

  // Installing again replaces them.
  await skills.installFromGitHub("Jakeschincariol/replica-skill", { home, download });

  // A link into one folder installs only what is in it.
  const one = await skills.installFromGitHub("https://github.com/o/r/tree/main/skills/pdf", {
    home,
    download: async () =>
      tarGz({
        "skills/pdf/SKILL.md": "---\nname: pdf\n---\n",
        "skills/xlsx/SKILL.md": "---\nname: xlsx\n---\n",
      }),
  });
  assert.deepEqual(one, ["pdf"]);

  // A repository that is one skill.
  const single = await skills.installFromGitHub("someone/My-Skill", {
    home,
    download: async () => tarGz({ "SKILL.md": "---\nname: mine\n---\n" }),
  });
  assert.deepEqual(single, ["my-skill"]);
  await assert.rejects(
    skills.installFromGitHub("someone/empty", {
      home,
      download: async () => tarGz({ "a.txt": "" }),
    }),
    /no SKILL.md/,
  );
});

test("the archive reader keeps files inside the target folder", () => {
  const dest = tmp();
  const evil = tarGz({ "../../escape.txt": "x", "ok/file.txt": "fine" });
  extractTarGz(evil, path.join(dest, "out"));
  assert.ok(fs.existsSync(path.join(dest, "out", "ok", "file.txt")));
  assert.equal(fs.existsSync(path.join(dest, "escape.txt")), false);
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
