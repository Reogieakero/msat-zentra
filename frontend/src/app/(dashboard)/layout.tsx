import Link from "next/link";
import { BookOpen, ClipboardList, FileText, Home, ScrollText, ShieldAlert, ShieldCheck, Bell } from "lucide-react";

const NAV = [
  { href: "/", label: "Overview", icon: Home },
  { href: "/grades", label: "Grades", icon: BookOpen },
  { href: "/attendance", label: "Attendance", icon: ClipboardList },
  { href: "/anecdotal", label: "Anecdotal", icon: FileText },
  { href: "/referrals", label: "Referrals", icon: FileText },
  { href: "/adm", label: "ADM", icon: ClipboardList },
  { href: "/sf10", label: "SF10", icon: ScrollText },
  { href: "/risk", label: "Risk", icon: ShieldAlert },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/audit", label: "Audit", icon: ShieldCheck },
];

export default function DashboardLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-60 shrink-0 border-r border-border p-4 md:block">
        <div className="mb-6 px-2">
          <p className="font-sans text-sm font-semibold tracking-tight text-foreground">
            Zentra
          </p>
          <p className="text-xs text-muted-foreground">SIS · scaffold</p>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-accent-foreground"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-x-hidden">{children}</main>
    </div>
  );
}
