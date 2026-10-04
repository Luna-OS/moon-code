import { useEffect, useState } from "react";
import { CloseIcon } from "../theme/icons";
import type { Settings, ThemeSetting, UpdateStatus } from "../lib/types";
import { UpdatesSection } from "./UpdatesSection";

/** The few settings Moon Code has. */
export function SettingsDialog({
  settings,
  onChange,
  onClose,
  update,
  onUpdateCheck,
  onUpdateDownload,
  onUpdateInstall,
}: {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onClose: () => void;
  update: UpdateStatus | null;
  onUpdateCheck: () => void;
  onUpdateDownload: () => void;
  onUpdateInstall: () => void;
}) {
  const [owner, setOwner] = useState(settings.githubOwner);
  const [claudePath, setClaudePath] = useState(settings.claudePath ?? "");
  const [projectsFolder, setProjectsFolder] = useState(settings.projectsFolder);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const themes: { id: ThemeSetting; label: string; hint: string }[] = [
    { id: "dark", label: "Night", hint: "The Moon night sky" },
    { id: "light", label: "Day", hint: "Lavender daylight" },
    { id: "system", label: "Follow Windows", hint: "Night or day like the system" },
  ];

  const commit = () =>
    onChange({
      githubOwner: owner.trim(),
      claudePath: claudePath.trim() || null,
      projectsFolder: projectsFolder.trim() || settings.projectsFolder,
    });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        className="mc-popover relative flex max-h-[85vh] w-[min(520px,92vw)] flex-col gap-4 overflow-auto p-5"
      >
        <div className="flex items-center">
          <h2 className="mc-title m-0 flex-1 text-[1.15rem] font-semibold">Settings</h2>
          <button type="button" className="mc-icon-btn" aria-label="Close" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        <fieldset className="m-0 border-0 p-0">
          <legend className="mc-label">Theme</legend>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Theme">
            {themes.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={settings.theme === t.id}
                className="mc-option"
                onClick={() => onChange({ theme: t.id })}
              >
                <span className="mc-option-title">{t.label}</span>
                <span className="mc-option-hint">{t.hint}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <UpdatesSection
          status={update}
          autoCheck={settings.autoUpdateCheck !== false}
          onAutoCheck={(on) => onChange({ autoUpdateCheck: on })}
          onCheck={onUpdateCheck}
          onDownload={onUpdateDownload}
          onInstall={onUpdateInstall}
        />

        <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 text-[0.8125rem]">
          <label htmlFor="mc-font-size">Font size</label>
          <input
            id="mc-font-size"
            type="number"
            min={10}
            max={28}
            className="mc-input w-20"
            value={settings.fontSize}
            onChange={(e) =>
              onChange({ fontSize: Math.min(28, Math.max(10, Number(e.target.value) || 14)) })
            }
          />
          <label htmlFor="mc-wrap">Wrap long lines</label>
          <input
            id="mc-wrap"
            type="checkbox"
            className="mc-switch"
            checked={settings.wordWrap}
            onChange={(e) => onChange({ wordWrap: e.target.checked })}
          />
          <label htmlFor="mc-autosave">Save files by themselves</label>
          <input
            id="mc-autosave"
            type="checkbox"
            className="mc-switch"
            checked={Boolean(settings.autoSave)}
            onChange={(e) => onChange({ autoSave: e.target.checked })}
          />
          <label htmlFor="mc-mascot">Axo, the axolotl, in the Claude panel</label>
          <input
            id="mc-mascot"
            type="checkbox"
            className="mc-switch"
            checked={settings.mascot !== false}
            onChange={(e) => onChange({ mascot: e.target.checked })}
          />
          <label htmlFor="mc-minimap">Minimap</label>
          <input
            id="mc-minimap"
            type="checkbox"
            className="mc-switch"
            checked={settings.minimap}
            onChange={(e) => onChange({ minimap: e.target.checked })}
          />
        </div>

        <div>
          <label className="mc-label" htmlFor="mc-owner">
            GitHub owner for Projects
          </label>
          <input
            id="mc-owner"
            className="mc-input w-full"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            onBlur={commit}
          />
          <p className="mb-0 mt-1 text-[0.6875rem] text-[var(--mc-text-faint)]">
            Used when the GitHub CLI isn&apos;t signed in; with gh, your own repositories show up.
          </p>
        </div>
        <div>
          <label className="mc-label" htmlFor="mc-projects">
            Clone repositories into
          </label>
          <input
            id="mc-projects"
            className="mc-input w-full"
            value={projectsFolder}
            onChange={(e) => setProjectsFolder(e.target.value)}
            onBlur={commit}
          />
        </div>
        <div>
          <label className="mc-label" htmlFor="mc-claude-path">
            Claude Code program (optional)
          </label>
          <input
            id="mc-claude-path"
            className="mc-input w-full"
            placeholder="Found on the PATH"
            value={claudePath}
            onChange={(e) => setClaudePath(e.target.value)}
            onBlur={commit}
          />
        </div>
      </div>
    </div>
  );
}
