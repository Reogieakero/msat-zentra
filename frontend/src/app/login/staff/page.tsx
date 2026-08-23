import { Briefcase } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";

export default function StaffLoginPage() {
  return (
    <AuthShell icon={Briefcase}>
      <LoginForm
        role="staff"
        title="Staff sign in"
        description="For teachers, advisers, guidance, and school leadership."
        emailLabel="School email"
        emailPlaceholder="name@msat.edu"
      />
    </AuthShell>
  );
}
