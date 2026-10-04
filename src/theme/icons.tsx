import type { ReactNode } from "react";

/*
 * Line icons in the Moon style: 24px grid, 2px round strokes, currentColor
 * (the same helper as Moon Explorer's, Moon Zip's and MoonTask's icons.tsx).
 */
function Svg({
  children,
  size = 16,
  stroke = 2,
}: {
  children: ReactNode;
  size?: number;
  stroke?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      {children}
    </svg>
  );
}

type P = { size?: number };

export const FilesIcon = ({ size = 22 }: P) => (
  <Svg size={size} stroke={1.75}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </Svg>
);

export const SearchIcon = ({ size = 22 }: P) => (
  <Svg size={size} stroke={1.75}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Svg>
);

/** Projects: a stack of folders. */
export const ProjectsIcon = ({ size = 22 }: P) => (
  <Svg size={size} stroke={1.75}>
    <path d="M3 8a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    <path d="M7 3h3l2 2h5" />
  </Svg>
);

/** Claude in Moon Code: a crescent with a spark (Moon Code's own mark, not Anthropic's logo). */
export const ClaudeIcon = ({ size = 22 }: P) => (
  <Svg size={size} stroke={1.75}>
    <path d="M15.5 19.5A8 8 0 1 1 12.2 4.1a6.2 6.2 0 0 0 7.7 9.6 8 8 0 0 1-4.4 5.8Z" />
    <path d="M18 2.5v4M16 4.5h4" />
  </Svg>
);

export const SettingsIcon = ({ size = 22 }: P) => (
  <Svg size={size} stroke={1.75}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
  </Svg>
);

export const AccountIcon = ({ size = 22 }: P) => (
  <Svg size={size} stroke={1.75}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </Svg>
);

export const TerminalIcon = ({ size }: P) => (
  <Svg size={size}>
    <path d="m4 17 6-5-6-5M12 19h8" />
  </Svg>
);

export const CloseIcon = ({ size = 14 }: P) => (
  <Svg size={size}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Svg>
);

export const PlusIcon = ({ size }: P) => (
  <Svg size={size}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const NewFileIcon = ({ size }: P) => (
  <Svg size={size}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M12 11v6M9 14h6" />
  </Svg>
);

export const NewFolderIcon = ({ size }: P) => (
  <Svg size={size}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    <path d="M12 10v6M9 13h6" />
  </Svg>
);

export const ReloadIcon = ({ size }: P) => (
  <Svg size={size}>
    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
    <path d="M21 3v6h-6" />
  </Svg>
);

/** Skills: an open book with a small star. */
export const SkillsIcon = ({ size = 22 }: P) => (
  <Svg size={size} stroke={size >= 20 ? 1.75 : 2}>
    <path d="M12 7v13M12 7c-1.6-1.4-4-2-8-2v13c4 0 6.4.6 8 2 1.6-1.4 4-2 8-2V5c-1.2 0-2.3.05-3.3.17" />
    <path d="m17.5 2 .6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6Z" />
  </Svg>
);

export const AttachIcon = ({ size = 15 }: P) => (
  <Svg size={size}>
    <path d="m21 11-8.6 8.6a5.5 5.5 0 0 1-7.8-7.8l8.6-8.6a3.7 3.7 0 0 1 5.2 5.2l-8.6 8.6a1.8 1.8 0 0 1-2.6-2.6L15 7" />
  </Svg>
);

export const BackIcon = ({ size = 15 }: P) => (
  <Svg size={size}>
    <path d="M19 12H5M11 18l-6-6 6-6" />
  </Svg>
);

export const ForwardIcon = ({ size = 15 }: P) => (
  <Svg size={size}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);

export const ChevronIcon = ({ size = 14, open = false }: P & { open?: boolean }) => (
  <Svg size={size}>
    <path d={open ? "m6 9 6 6 6-6" : "m9 6 6 6-6 6"} />
  </Svg>
);

export const FolderIcon = ({ size = 16, open = false }: P & { open?: boolean }) => (
  <Svg size={size}>
    {open ? (
      <>
        <path d="M4 19a1 1 0 0 1-1-1V7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v2" />
        <path d="M4 19h13l3.5-8H7.5Z" />
      </>
    ) : (
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    )}
  </Svg>
);

export const FileIcon = ({ size = 16 }: P) => (
  <Svg size={size}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
  </Svg>
);

export const SendIcon = ({ size }: P) => (
  <Svg size={size}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </Svg>
);

export const StopIcon = ({ size }: P) => (
  <Svg size={size}>
    <rect x="7" y="7" width="10" height="10" rx="2" />
  </Svg>
);

export const BranchIcon = ({ size = 13 }: P) => (
  <Svg size={size}>
    <circle cx="6" cy="5" r="2" />
    <circle cx="6" cy="19" r="2" />
    <circle cx="18" cy="7" r="2" />
    <path d="M6 7v10M18 9a6 6 0 0 1-6 6H6" />
  </Svg>
);

export const MoonIcon = ({ size = 14 }: P) => (
  <Svg size={size}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
  </Svg>
);

export const SunIcon = ({ size = 14 }: P) => (
  <Svg size={size}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Svg>
);

export const DownloadIcon = ({ size }: P) => (
  <Svg size={size}>
    <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
  </Svg>
);

export const CloudIcon = ({ size }: P) => (
  <Svg size={size}>
    <path d="M17.5 19a4.5 4.5 0 1 0-1.4-8.8A6 6 0 0 0 4.5 12 3.5 3.5 0 0 0 6 19Z" />
  </Svg>
);

export const ToolIcon = ({ size = 13 }: P) => (
  <Svg size={size}>
    <path d="M14.7 6.3a4 4 0 0 0-5.4 5.3L3 18l3 3 6.4-6.3a4 4 0 0 0 5.3-5.4l-2.6 2.6-2.4-.6-.6-2.4Z" />
  </Svg>
);

export const AlertIcon = ({ size = 14 }: P) => (
  <Svg size={size}>
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9v4M12 17h.01" />
  </Svg>
);

export const CheckIcon = ({ size = 14 }: P) => (
  <Svg size={size}>
    <path d="m5 12 5 5L20 7" />
  </Svg>
);

export const HistoryIcon = ({ size }: P) => (
  <Svg size={size}>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5M12 7v5l3 2" />
  </Svg>
);

export const LogoutIcon = ({ size }: P) => (
  <Svg size={size}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
  </Svg>
);

export const ExternalIcon = ({ size = 13 }: P) => (
  <Svg size={size}>
    <path d="M14 3h7v7M21 3l-9 9M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5" />
  </Svg>
);

export const SparkIcon = ({ size = 14 }: P) => (
  <Svg size={size}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />
  </Svg>
);
