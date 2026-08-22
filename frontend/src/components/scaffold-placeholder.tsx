import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function ScaffoldPlaceholder({
  title,
  description,
  moduleId,
}: {
  title: string;
  description: string;
  moduleId: string;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center gap-3">
        <h1 className="font-sans text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        <Badge variant="secondary" className="font-mono text-xs">
          scaffold
        </Badge>
      </div>
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base">Not yet implemented</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Module <span className="font-mono text-xs">/api/{moduleId}</span> is
            wired on the backend. UI screens land in a later sprint.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
