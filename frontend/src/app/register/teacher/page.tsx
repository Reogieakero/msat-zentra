import { AuthShell } from "@/components/auth/AuthShell";
import { RegisterForm } from "@/components/auth/RegisterForm";

export default function TeacherRegisterPage() {
  return (
    <AuthShell role="staff">
      <RegisterForm
        role="teacher"
        title="Teacher sign up"
        description="Request a teacher account. An administrator reviews and approves every request before you can sign in."
      />
    </AuthShell>
  );
}
