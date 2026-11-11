import { AuthShell } from "@/components/auth/AuthShell";
import { RegisterForm } from "@/components/auth/RegisterForm";

export default function ParentRegisterPage() {
  return (
    <AuthShell role="parent">
      <RegisterForm
        role="parent"
        title="Parent sign up"
        description="Request a parent/guardian account. The school reviews the request before you can sign in."
      />
    </AuthShell>
  );
}
