import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <Card className="w-full max-w-sm border-border">
        <CardHeader>
          <div className="mb-2 flex items-center gap-2">
            <CardTitle className="text-lg">Zentra</CardTitle>
            <Badge variant="secondary" className="font-mono text-xs">
              scaffold
            </Badge>
          </div>
          <CardDescription>
            Sign in with your staff or student account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Auth UI lands later. The backend supports{" "}
            <span className="font-mono text-xs">/api/auth/login</span> (JWT) and
            Supabase Auth (Google Sign-In planned). Token refresh is wired in{" "}
            <span className="font-mono text-xs">lib/api/client.ts</span>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
