"use strict";
// Claude Code's skills: folders with a SKILL.md that Claude loads when a task needs them. Personal
// ones live in ~/.claude/skills (every project), a project's own in <project>/.claude/skills. The
// Skills view lists both, makes new ones and installs skills from a GitHub repository (every folder
// with a SKILL.md in it is copied into ~/.claude/skills).
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const { claudeHome } = require("./account.cjs");

const personalDir = (home = claudeHome()) => path.join(home, "skills");
const projectDir = (project) => path.join(project, ".claude", "skills");

/** The `name` and `description` of a SKILL.md's front matter (--- … ---). */
function parseFrontMatter(text) {
  const m = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---/.exec(String(text));
  const out = {};
  if (!m) return out;
  const lines = m[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const kv = /^([A-Za-z_-]+):\s*(.*)$/.exec(lines[i]);
    if (!kv) continue;
    let value = kv[2].trim();
    // A folded or literal block (description: >- …) goes on in the indented lines below.
    if (/^[>|][-+]?$/.test(value)) {
      const block = [];
      while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) block.push(lines[++i].trim());
      value = block.join(" ");
    }
    out[kv[1]] = value.replace(/^(["'])(.*)\1$/, "$2");
  }
  return out;
}

/** The skills in one skills folder: [{ name, description, dir, file, scope }]. */
function skillsIn(dir, scope) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const e of entries) {
    if (!e.isDirectory() && !e.isSymbolicLink()) continue;
    const file = path.join(dir, e.name, "SKILL.md");
    let text;
    try {
      text = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const fm = parseFrontMatter(text);
    out.push({
      name: fm.name || e.name,
      folder: e.name,
      description: fm.description || "",
      dir: path.join(dir, e.name),
      file,
      scope,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** The project's skills (when a folder is open) and the personal ones. */
function listSkills(project, home = claudeHome()) {
  return [
    ...(project ? skillsIn(projectDir(project), "project") : []),
    ...skillsIn(personalDir(home), "personal"),
  ];
}

/** A skill folder's name: lowercase letters, digits and dashes. */
function skillSlug(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

/** Makes a new skill with a SKILL.md to fill in; resolves to its SKILL.md. */
function createSkill({ name, description, scope, project }, home = claudeHome()) {
  const slug = skillSlug(name);
  if (!slug) throw new Error("Give the skill a name.");
  if (scope === "project" && !project) throw new Error("Open a folder for a project skill.");
  const dir = path.join(scope === "project" ? projectDir(project) : personalDir(home), slug);
  if (fs.existsSync(dir)) {
    const err = new Error(`A skill named ${slug} already exists.`);
    err.code = "EEXIST";
    throw err;
  }
  fs.mkdirSync(dir, { recursive: true });
  const desc =
    String(description || "").trim() || `What ${slug} does and when Claude should use it.`;
  const file = path.join(dir, "SKILL.md");
  fs.writeFileSync(
    file,
    `---\nname: ${slug}\ndescription: ${desc.replace(/\r?\n/g, " ")}\n---\n\n# ${name}\n\n` +
      "Tell Claude here how to do the task, step by step. Put scripts or examples next to this file\n" +
      "and mention them; Claude reads them when it needs them.\n",
  );
  return file;
}

/** The folders under `root` (a few levels deep) that hold a SKILL.md, without .git. */
function findSkillDirs(root, depth = 4) {
  const out = [];
  const walk = (dir, d) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    if (dir !== root && entries.some((e) => e.isFile() && e.name === "SKILL.md")) {
      out.push(dir);
      return;
    }
    if (d === 0) return;
    for (const e of entries) {
      if (e.isDirectory() && e.name !== ".git" && e.name !== "node_modules") {
        walk(path.join(dir, e.name), d - 1);
      }
    }
  };
  // A repository that is one skill (SKILL.md at the top) is that skill.
  if (fs.existsSync(path.join(root, "SKILL.md"))) return [root];
  walk(root, depth);
  return out;
}

/** A GitHub repository from "owner/name", a github.com link or a .git URL; null otherwise. */
function gitUrl(input) {
  const s = String(input || "").trim();
  if (/^[\w.-]+\/[\w.-]+$/.test(s))
    return { url: `https://github.com/${s}.git`, name: s.split("/")[1] };
  const m =
    /^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[/?#].*)?$/.exec(s);
  return m ? { url: `https://github.com/${m[1]}/${m[2]}.git`, name: m[2] } : null;
}

function gitClone(url, target) {
  return new Promise((resolve, reject) => {
    const child = spawn("git", ["clone", "--depth", "1", "--", url, target], { windowsHide: true });
    let err = "";
    child.stderr.on("data", (d) => (err = (err + d).slice(-2000)));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(err.trim() || `git clone failed (${code}).`)),
    );
  });
}

/**
 * Installs the skills of a GitHub repository as personal skills: clones it (shallow, into a
 * temporary folder) and copies every folder with a SKILL.md into ~/.claude/skills. Skills that
 * are there already are replaced. Resolves to the installed folder names.
 */
async function installFromGitHub(input, { home = claudeHome(), clone = gitClone } = {}) {
  const repo = gitUrl(input);
  if (!repo) throw new Error("That isn't a GitHub repository (owner/name or its link).");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "moon-code-skill-"));
  try {
    const src = path.join(tmp, "repo");
    await clone(repo.url, src);
    const dirs = findSkillDirs(src);
    if (!dirs.length) throw new Error(`${repo.name} has no SKILL.md in it.`);
    const dest = personalDir(home);
    fs.mkdirSync(dest, { recursive: true });
    const installed = [];
    for (const dir of dirs) {
      const name = dir === src ? skillSlug(repo.name) : path.basename(dir);
      const target = path.join(dest, name);
      fs.rmSync(target, { recursive: true, force: true });
      fs.cpSync(dir, target, {
        recursive: true,
        filter: (p) => !p.split(path.sep).includes(".git"),
      });
      installed.push(name);
    }
    return installed;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/** `dir` when it is a skill folder (right inside a skills folder), so it may be removed. */
function skillFolder(dir, project, home = claudeHome()) {
  const parents = [personalDir(home), project ? projectDir(project) : null].filter(Boolean);
  const resolved = path.resolve(String(dir || ""));
  if (!parents.some((p) => path.dirname(resolved) === path.resolve(p))) {
    throw new Error("That isn't a skill folder.");
  }
  return resolved;
}

module.exports = {
  parseFrontMatter,
  listSkills,
  skillSlug,
  createSkill,
  findSkillDirs,
  gitUrl,
  installFromGitHub,
  skillFolder,
  personalDir,
};
