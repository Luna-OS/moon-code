/* Axo's moods, colours and lines (the component is Axolotl.tsx). */

export type AxoMood = "idle" | "work" | "done" | "sleep";

/** The sprite's colours: the Moon palette plus the axolotl's pink gills. */
export const AXOLOTL_COLORS: Record<string, string> = {
  O: "#5b4f9e", // outline
  W: "#fbf7f0", // body (cream-100)
  S: "#ddd6ff", // belly spots
  G: "#f6a8c8", // gills
  g: "#e586b2", // gill stems
  E: "#1d1742", // eyes (night-800)
  e: "#ffffff", // the light in the eyes
  C: "#f7b89a", // cheeks (peach-300)
  M: "#e586b2", // mouth
  L: "#b9aefb", // the laptop lid (lavender-400)
  K: "#8f82e0", // the laptop base
  m: "#f4f1ff", // the moon on the lid (moon-100)
  T: "#ffffff", // sparkle centre
  t: "#7fe3c6", // sparkle (mint-400, Claude's colour)
};

/** What Axo says under itself about what Claude does right now. */
export function axoLine(mood: AxoMood, activity: string | null): string {
  switch (mood) {
    case "sleep":
      return "Sign in and I'll wake up.";
    case "work":
      return activity ?? "Thinking…";
    case "done":
      return "Done!";
    default:
      return "Ready when you are.";
  }
}
