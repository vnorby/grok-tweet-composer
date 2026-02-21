const MAX = 280;

interface Props {
  count: number;
}

export function CharCounter({ count }: Props) {
  const remaining = MAX - count;
  const pct = Math.min(count / MAX, 1);
  const radius = 10;
  const circumference = 2 * Math.PI * radius;
  const dash = pct * circumference;

  const isWarning = remaining <= 20;
  const isDanger = remaining <= 0;

  const color = isDanger
    ? "#ff4757"
    : isWarning
    ? "#f5a623"
    : "var(--accent)";

  return (
    <div className="flex items-center gap-2">
      {isWarning && (
        <span
          className="text-sm tabular-nums"
          style={{ color, fontFamily: "var(--font-mono, monospace)" }}
        >
          {remaining}
        </span>
      )}
      <svg width="24" height="24" viewBox="0 0 24 24" role="img" aria-label={`${remaining} characters remaining`}>
        {/* Track */}
        <circle
          cx="12"
          cy="12"
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth="2"
        />
        {/* Progress */}
        <circle
          cx="12"
          cy="12"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeDashoffset={circumference / 4}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.1s, stroke 0.2s" }}
        />
      </svg>
    </div>
  );
}
