import { GraduationCap } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { RegisterForm } from "@/components/auth/RegisterForm";

export default function RegisterPage() {
  return (
    <AuthShell icon={GraduationCap} role="student">
      <RegisterForm
        role="student"
        title="Student sign up"
        description="Request a student account. Your LRN is checked against the official roster before approval."
      />
    </AuthShell>
  );
}
