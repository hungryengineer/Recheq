export default function LoadingStatus() {
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-border)] border-t-[var(--color-accent)]"></div>
      <p className="text-sm text-[var(--color-fg-muted)]">Loading status...</p>
    </div>
  );
}
