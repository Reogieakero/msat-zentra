export default function PrincipalScheduleLoading() {
  return (
    <section
      className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_2.75rem]"
      aria-label="Loading schedule"
      aria-busy="true"
    >
      <div className="flex min-h-[calc(100dvh-8rem)] flex-col justify-center" aria-hidden="true">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 rounded-xl border border-border p-2.5">
          <div className="h-4 w-40 rounded bg-muted" />
          <div className="h-40 rounded-lg bg-muted/60" />
        </div>
      </div>
      <div className="flex flex-col items-end gap-2" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-9 w-9 rounded-xl border border-border bg-card" />
        ))}
      </div>
    </section>
  );
}
