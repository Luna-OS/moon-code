/** Fixed, decorative night sky (stars + crescent moon) behind the app. */
export function Sky({ moon = true }: { moon?: boolean }) {
  return (
    <div className="mc-sky" aria-hidden="true">
      {moon && <div className="mc-moon" />}
    </div>
  );
}
