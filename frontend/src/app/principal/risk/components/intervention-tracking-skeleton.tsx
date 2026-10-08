"use client";
import { TableRow, TableCell } from "@/components/ui/table";
import styles from "./InterventionTrackingTable.module.css";
export function InterventionTrackingSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <div className={styles.studentCell}>
              <span className={styles.skelName} />
              <span className={styles.skelLrn} />
            </div>
          </TableCell>
          <TableCell>
            <span className={styles.skelCell} style={{ width: "50%" }} />
          </TableCell>
          <TableCell>
            <span className={styles.skelCell} style={{ width: "38%" }} />
          </TableCell>
          <TableCell>
            <span className={styles.skelCell} style={{ width: "60%" }} />
          </TableCell>
          <TableCell>
            <span className={styles.skelCell} style={{ width: "46%" }} />
          </TableCell>
          <TableCell>
            <span className={styles.skelCell} style={{ width: "70%" }} />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
