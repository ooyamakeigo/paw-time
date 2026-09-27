const tones = ["orange", "lav", "sky", "green"] as const;

/** A round initial badge, colored like the choice markers in the worker app. */
export function Avatar({ name, seed }: { name: string; seed: string }) {
  let hash = 0;
  for (const character of seed) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  const tone = tones[hash % tones.length] ?? "orange";
  return (
    <div aria-hidden="true" className={`avatar avatar-${tone}`}>
      {name.slice(0, 1)}
    </div>
  );
}
