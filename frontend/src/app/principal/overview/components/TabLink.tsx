import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import styles from "./tab-link.module.css";

export function TabLink({ href, label }: { href: string; label: string }) {
  return (
    <Button asChild variant="outline" size="sm" className={styles.tabLink}>
      <a href={href}>
        Open {label}
        <ArrowRight aria-hidden />
      </a>
    </Button>
  );
}
