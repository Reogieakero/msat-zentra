import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";

export default function StaffLoginPage() {
  return (
    <AuthShell role="staff">
      <LoginForm
        role="staff"
        title="Staff sign in"
        description="For teachers, advisers, guidance, ADM coordinator, and school leadership."
        emailLabel="School email"
        emailPlaceholder="name@msat.edu"
        signupHref="/register/teacher"
        signupLabel="Sign up"
      />
    </AuthShell>
  );
}
