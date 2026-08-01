import type { Sentiment } from "@/lib/types";
const colors: Record<Sentiment, string> = {
  positive: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  negative: "border-rose-500/30 bg-rose-500/10 text-rose-400",
  neutral: "border-amber-500/30 bg-amber-500/10 text-amber-400",
};
export function SentimentBadge({ sentiment }: { sentiment: Sentiment }) {
  return (
    <span
      className={`rounded-md border px-2 py-1 text-xs font-medium capitalize ${colors[sentiment]}`}
    >
      {sentiment} tone
    </span>
  );
}
