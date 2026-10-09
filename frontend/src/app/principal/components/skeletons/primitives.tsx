import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function SkeletonText({
  className,
  width = "w-full",
}: {
  className?: string;
  width?: string;
}) {
  return <Skeleton aria-hidden="true" className={cn("h-4", width, className)} />;
}

export function SkeletonAvatar({ className }: { className?: string }) {
  return (
    <Skeleton
      aria-hidden="true"
      className={cn("size-10 shrink-0 rounded-full", className)}
    />
  );
}

export function SkeletonButton({
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
