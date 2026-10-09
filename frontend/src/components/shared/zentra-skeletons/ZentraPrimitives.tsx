import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function ZentraSkeletonText({
  className,
  width = "w-full",
}: {
  className?: string;
  width?: string;
}) {
  return <Skeleton aria-hidden="true" className={cn("h-4", width, className)} />;
}

export function ZentraSkeletonAvatar({ className }: { className?: string }) {
  return (
    <Skeleton
      aria-hidden="true"
      className={cn("size-10 shrink-0 rounded-full", className)}
    />
  );
}

export function ZentraSkeletonButton({
  className,
  width = "w-24",
}: {
  className?: string;
  width?: string;
}) {
  return (
    <Skeleton aria-hidden="true" className={cn("h-9", width, className)} />
  );
}
