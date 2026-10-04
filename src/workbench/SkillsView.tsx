import { useEffect, useState } from "react";
import { DownloadIcon, PlusIcon, ReloadIcon, SkillsIcon } from "../theme/icons";
import { basename } from "../lib/paths";
import type { MoonCodeBridge, Skill } from "../lib/types";

/**
 * Skills: what Claude Code can do on top – folders with a SKILL.md that Claude loads when a task
 * needs them. Lists the open project's skills and your personal ones (every project), makes new
 * ones, installs skills from a GitHub repository, and hands one to the chat ("/name").
 */
export function SkillsView({
  bridge,
  folder,
  onOpenFile,
  onUse,
  onNotify,
}: {
  bridge: MoonCodeBridge;
  folder: string | null;
  onOpenFile: (path: string) => void;
  /** Puts "/<skill> " into the Claude panel's message box. */
  onUse: (name: string) => void;
  onNotify: (message: string) => void;
}) {
  const [skills, setSkills] = useState<Skill[] | null>(null);
  const [nonce, setNonce] = useState(0);
  const [repo, setRepo] = useState("");
  const [installing, setInstalling] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState<"personal" | "project">("personal");

  useEffect(() => {
    let cancelled = false;
    bridge
      .skillsList(folder)
      .then((list) => !cancelled && setSkills(list))
      .catch(() => !cancelled && setSkills([]));
    return () => {
      cancelled = true;
    };
  }, [bridge, folder, nonce]);
  const reload = () => setNonce((n) => n + 1);

  const install = async () => {
    const r = repo.trim();
    if (!r || installing) return;
    setInstalling(true);
    try {
      const names = await bridge.skillsInstall(r);
      onNotify(
        `Installed ${names.length === 1 ? `the skill ${names[0]}` : `${names.length} skills`}.`,
      );
      setRepo("");
      reload();
    } catch (e) {
      onNotify((e as Error).message);
    } finally {
      setInstalling(false);
    }
  };

  const create = async () => {
    if (!name.trim()) return;
    try {
      const file = await bridge.skillsCreate({
        name: name.trim(),
        description: description.trim(),
        scope: folder ? scope : "personal",
        project: folder,
      });
      setName("");
      setDescription("");
      setCreating(false);
      reload();
      onOpenFile(file);
    } catch (e) {
      onNotify((e as Error).message);
    }
  };

  const remove = async (s: Skill) => {
    if (!window.confirm(`Remove the skill ${s.name}? It goes to the recycle bin.`)) return;
    try {
      await bridge.skillsRemove(s.dir, folder);
      reload();
    } catch (e) {
      onNotify((e as Error).message);
    }
  };

  const project = (skills ?? []).filter((s) => s.scope === "project");
  const personal = (skills ?? []).filter((s) => s.scope === "personal");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mc-section-title">
        <span className="flex-1">Skills</span>
        <button
          type="button"
          className="mc-icon-btn"
          style={{ width: 24, height: 24 }}
          aria-label="New skill"
          title="New skill"
          onClick={() => setCreating((c) => !c)}
        >
          <PlusIcon size={14} />
        </button>
        <button
          type="button"
          className="mc-icon-btn"
          style={{ width: 24, height: 24 }}
          aria-label="Reload the skills"
          title="Reload"
          onClick={reload}
        >
          <ReloadIcon size={13} />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto px-3 pb-4 text-[0.8125rem]">
        <p className="m-0 text-[0.75rem] text-[var(--mc-text-muted)]">
          Skills teach Claude how to do a task your way. Claude uses one by itself when a task fits
          it, or when you call it with /name.
        </p>

        {creating && (
          <section className="mc-inset flex flex-col gap-2 p-2.5" aria-label="New skill">
            <input
              className="mc-input w-full"
              placeholder="Name (release-notes)"
              aria-label="Skill name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <textarea
              className="mc-input w-full"
              rows={2}
              placeholder="What it does and when Claude should use it"
              aria-label="Skill description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            {folder && (
              <select
                className="mc-input w-full"
                aria-label="Where the skill lives"
                value={scope}
                onChange={(e) => setScope(e.target.value as "personal" | "project")}
              >
                <option value="personal">Personal – in every project</option>
                <option value="project">Only {basename(folder)} (.claude/skills)</option>
              </select>
            )}
            <div className="flex justify-end gap-1.5">
              <button
                type="button"
                className="mc-btn mc-btn-ghost mc-btn-sm"
                onClick={() => setCreating(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="mc-btn mc-btn-primary mc-btn-sm"
                disabled={!name.trim()}
                onClick={() => void create()}
              >
                Create and edit
              </button>
            </div>
          </section>
        )}

        <section className="flex flex-col gap-1.5" aria-label="Install skills">
          <h3 className="mc-eyebrow m-0">Install from GitHub</h3>
          <div className="flex gap-1.5">
            <input
              className="mc-input min-w-0 flex-1"
              placeholder="owner/repository or its link"
              aria-label="GitHub repository with skills"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void install()}
            />
            <button
              type="button"
              className="mc-btn mc-btn-sm"
              disabled={!repo.trim() || installing}
              onClick={() => void install()}
            >
              <DownloadIcon size={12} /> {installing ? "Installing…" : "Install"}
            </button>
          </div>
        </section>

        {skills === null && (
          <span className="text-[0.75rem] text-[var(--mc-text-faint)]">Loading…</span>
        )}
        {folder && (
          <SkillGroup
            title={`This project · ${basename(folder)}`}
            skills={project}
            empty="No skills in this project's .claude/skills yet."
            onOpenFile={onOpenFile}
            onUse={onUse}
            onRemove={(s) => void remove(s)}
          />
        )}
        <SkillGroup
          title="Personal"
          skills={personal}
          empty="No personal skills yet. Make one with +, or install some from GitHub."
          onOpenFile={onOpenFile}
          onUse={onUse}
          onRemove={(s) => void remove(s)}
        />
      </div>
    </div>
  );
}

function SkillGroup({
  title,
  skills,
  empty,
  onOpenFile,
  onUse,
  onRemove,
}: {
  title: string;
  skills: Skill[];
  empty: string;
  onOpenFile: (path: string) => void;
  onUse: (name: string) => void;
  onRemove: (skill: Skill) => void;
}) {
  return (
    <section className="flex flex-col gap-1" aria-label={title}>
      <h3 className="mc-eyebrow m-0 flex items-center gap-1.5">
        <SkillsIcon size={12} /> {title}
        <span className="text-[var(--mc-text-faint)]">{skills.length || ""}</span>
      </h3>
      {skills.length === 0 && (
        <p className="m-0 text-[0.75rem] text-[var(--mc-text-faint)]">{empty}</p>
      )}
      {skills.map((s) => (
        <div key={s.dir} className="mc-inset flex flex-col gap-1 px-2.5 py-2">
          <span className="truncate font-medium">{s.name}</span>
          {s.description && (
            <span className="line-clamp-3 text-[0.75rem] text-[var(--mc-text-muted)]">
              {s.description}
            </span>
          )}
          <div className="flex flex-wrap gap-1" role="group" aria-label={`Skill ${s.name}`}>
            <button
              type="button"
              className="mc-btn mc-btn-sm"
              title={`Put /${s.name} into the message to Claude`}
              onClick={() => onUse(s.name)}
            >
              Use
            </button>
            <button
              type="button"
              className="mc-btn mc-btn-ghost mc-btn-sm"
              onClick={() => onOpenFile(s.file)}
            >
              Edit
            </button>
            <button
              type="button"
              className="mc-btn mc-btn-ghost mc-btn-sm"
              onClick={() => onRemove(s)}
            >
              Remove
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
