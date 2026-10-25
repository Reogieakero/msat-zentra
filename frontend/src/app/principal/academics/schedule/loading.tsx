export default function PrincipalScheduleLoading() {
  return (
    <section
      className="flex w-full flex-col justify-center gap-5 pt-12 min-h-[calc(100dvh-8rem)]"
      aria-label="Loading schedule"
      aria-busy="true"
    >
      <div className="mx-auto w-full max-w-5xl" aria-hidden="true">
        <div className="flex flex-col gap-3 rounded-xl border border-border p-2.5">
          <div className="h-4 w-40 rounded bg-muted" />
          <div className="h-40 rounded-lg bg-muted/60" />
        </div>
      </div>
    </section>
  );
}
