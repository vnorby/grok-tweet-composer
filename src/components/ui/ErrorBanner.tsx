interface Props {
  message: string;
  onDismiss?: () => void;
}

export function ErrorBanner({ message, onDismiss }: Props) {
  return (
    <div
      role="alert"
      className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm"
      style={{
        background: "rgba(255,71,87,0.12)",
        border: "1px solid rgba(255,71,87,0.3)",
        color: "#ff4757",
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="ml-2 opacity-70 hover:opacity-100 transition-opacity"
          aria-label="Dismiss error"
        >
          ✕
        </button>
      )}
    </div>
  );
}
