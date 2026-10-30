import { ZentraPageHeaderSkeleton, KanbanBoardSkeleton, IconRailSkeleton } from "@/components/shared/zentra-skeletons/ZentraSkeletons";

export default function PrincipalSettingsLoading() {
  return (
    <section
      className="mx-auto flex w-full max-w-3xl flex-col gap-3"
      aria-label="Loading settings"
      aria-busy="true"
    >
      <ZentraPageHeaderSkeleton />
      <div className="flex w-full min-w-0 flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_2.75rem] lg:items-start lg:gap-5" aria-hidden="true">
        <div className="flex w-full min-w-0 flex-col gap-3">
          <KanbanBoardSkeleton rows={2} titleWidth="7rem" showDescription />
          <KanbanBoardSkeleton rows={2} titleWidth="6rem" showDescription />
          <KanbanBoardSkeleton rows={3} titleWidth="6rem" />
          <KanbanBoardSkeleton rows={3} titleWidth="6rem" />
        </div>
        <IconRailSkeleton count={4} />
      </div>
    </section>
  );
}
