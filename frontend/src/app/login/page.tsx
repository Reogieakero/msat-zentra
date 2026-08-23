import Link from "next/link";
import { GraduationCap, Users, Briefcase } from "lucide-react";
import { RoleCard } from "@/components/auth/RoleCard";
import { LoginHeader } from "./LoginHeader";
import styles from "./login.module.css";

const ROLE_OPTIONS = [
  {
    href: "/login/students",
    label: "Student",
    description: "Access your grades, attendance, and learner records.",
    icon: GraduationCap,
  },
  {
    href: "/login/staff",
    label: "Staff",
    description: "Teachers, advisers, guidance, and school leadership.",
    icon: Briefcase,
  },
  {
    href: "/login/parents",
    label: "Parent / Guardian",
    description: "Follow your child's progress and school updates.",
    icon: Users,
  },
];

export default function LoginPage() {
  return (
    <main className={styles.page}>
      <LoginHeader />

      <div className={styles.center}>
        <div className={styles.inner}>
          <div className={styles.intro}>
            <p className={styles.eyebrow}>
              <span className={styles.rule} aria-hidden />
              Mati School of Arts and Trades
              <span className={styles.rule} aria-hidden />
            </p>
            <h1 className={styles.title}>Sign in to Zentra</h1>
            <p className={styles.lede}>
              Choose the account type that matches your role to continue.
            </p>
          </div>

          <div className={styles.grid}>
            {ROLE_OPTIONS.map((option) => (
              <RoleCard key={option.href} {...option} />
            ))}
          </div>

          <p className={styles.note}>
            Need an account? Contact your school administrator for access.
          </p>
        </div>
      </div>
    </main>
  );
}
