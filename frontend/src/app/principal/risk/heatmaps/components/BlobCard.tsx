import * as React from "react";

type BlobCardProps = React.HTMLAttributes<HTMLDivElement> & {
  className?: string;
  children?: React.ReactNode;
};

// Card that tracks the cursor with a radial-gradient "blob" (see .blob in the
// consuming module). Sets --mx/--my custom properties on pointer move so the
// CSS overlay can follow the mouse without re-rendering.
export function BlobCard({ className, children, ...rest }: BlobCardProps) {
  const ref = React.useRef<HTMLDivElement>(null);

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    el.style.setProperty("--my", `${e.clientY - rect.top}px`);
  };

  return (
    <div ref={ref} className={className} onMouseMove={handleMove} {...rest}>
      {children}
    </div>
  );
}
