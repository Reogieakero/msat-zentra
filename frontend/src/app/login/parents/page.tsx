import { Users } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";

export default function ParentLoginPage() {
  return (
    <AuthShell icon={Users}>
      <LoginForm
        role="parent"
        title="Parent / Guardian sign in"
        description="Follow your child's progress and school updates."
        identifierLabel="Email or linked mobile"
        identifierPlaceholder="you@example.com or 09XXXXXXXXX"
      />
    </AuthShell>
  );
}
