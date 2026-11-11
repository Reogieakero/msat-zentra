import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";

/**
 * Dedicated administrator sign-in. This portal is never linked from the public
 * account picker — admin accounts cannot sign in through the staff portal.
 */
export default function AdminLoginPage() {
  return (
    <AuthShell role="admin">
      <LoginForm
        role="admin"
        title="Administrator sign in"
        description="Restricted access for the system administrator."
        emailLabel="Administrator email"
        emailPlaceholder="admin@msat.edu"
        showSignup={false}
        showGoogle={false}
      />
    </AuthShell>
  );
}
