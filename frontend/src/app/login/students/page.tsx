import { GraduationCap } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";

export default function StudentLoginPage() {
  return (
    <AuthShell icon={GraduationCap} role="student">
      <LoginForm
        role="student"
        title="Student sign in"
        description="Use your school email and password to view your records."
        identifierLabel="LRN or email"
        identifierPlaceholder="12-3456-78901 or you@msat.edu"
      />
    </AuthShell>
  );
}
