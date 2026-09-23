// Job copy is authored as plain text with "- " bullet lines. Splitting on that
// is enough structure for a job post and keeps the public bundle small.
export function JobBody({ text }: { text: string | null }) {
  if (!text) return null;
  const blocks = text.split(/\n{2,}/);

  return (
    <div className="prose-job text-[15px] text-muted-foreground">
      {blocks.map((block, i) => {
        const lines = block.split('\n');
        const isList = lines.every((l) => l.trim().startsWith('-'));
        if (isList) {
          return (
            <ul key={i} className="mb-4">
              {lines.map((l, j) => (
                <li key={j}>{l.replace(/^\s*-\s*/, '')}</li>
              ))}
            </ul>
          );
        }
        return <p key={i}>{block}</p>;
      })}
    </div>
  );
}
