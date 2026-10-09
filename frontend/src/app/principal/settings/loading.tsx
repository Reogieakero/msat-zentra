import { PageHeaderSkeleton } from "../components/skeletons/PageHeaderSkeleton";

export default function PrincipalSettingsLoading() {
  return (
    <section
      className="mx-auto flex w-full max-w-3xl flex-col gap-5"
      aria-label="Loading settings"
      aria-busy="true"
    >
      <PageHeaderSkeleton />
      <div className="grid items-start gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]" aria-hidden="true">
        <div className="h-48 rounded-md border bg-card p-4" />
        <div className="flex min-w-0 flex-col gap-5">
          <div className="h-56 rounded-md border bg-card p-4" />
          <div className="h-40 rounded-md border bg-card p-4" />
          <div className="h-64 rounded-md border bg-card p-4" />
        </div>
      </div>
    </section>
  );
}
