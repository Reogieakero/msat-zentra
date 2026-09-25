"use client";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import tableStyles from "./StudentTable.module.css";
import subjectStyles from "./SubjectStudents.module.css";
import skel from "./advisory-students-skeleton.module.css";

const TABLE_SKELETON_ROWS = 15;
const SUBJECT_SKELETON_ROWS = 10;

/* StudentTable placeholder — same 6-column structure as the loaded roster
   (Student / LRN / Birthday / Gender / At-Risk Level / actions), with a
   badge-sized slot in the risk cell and a menu-button slot in the action
   cell. Header, search, filter, and pagination stay live around this. */
export function StudentTableRowsSkeleton({ rows = TABLE_SKELETON_ROWS }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <span className={tableStyles.student}>
              <Skeleton className={tableStyles.skelAvatar} />
              <Skeleton className={skel.cellName} />
            </span>
          </TableCell>
          <TableCell>
            <Skeleton className={skel.cellLrn} />
          </TableCell>
          <TableCell>
            <Skeleton className={skel.cellBirth} />
          </TableCell>
          <TableCell>
            <Skeleton className={skel.cellGender} />
          </TableCell>
          <TableCell className={tableStyles.riskCell}>
            <Skeleton className={skel.badgeSlot} style={{ margin: "0 auto" }} />
          </TableCell>
          <TableCell>
            <Skeleton className={skel.actionSlot} />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

/* SubjectStudents placeholder — same 6-column structure as the loaded
   subject grades table (Student / LRN / Computed / Transmuted /
   Academic Risk / Remarks). Header and search stay live around this. */
export function SubjectGradesSkeleton({ rows = SUBJECT_SKELETON_ROWS }: { rows?: number }) {
  return (
    <Table aria-label="Loading grades" aria-busy="true">
      <TableHeader>
        <TableRow>
          <TableHead><Skeleton className={skel.headCell} style={{ width: "4rem" }} /></TableHead>
          <TableHead><Skeleton className={skel.headCell} style={{ width: "2.5rem" }} /></TableHead>
          <TableHead><Skeleton className={skel.headCell} style={{ width: "4rem" }} /></TableHead>
          <TableHead><Skeleton className={skel.headCell} style={{ width: "4.5rem" }} /></TableHead>
          <TableHead><Skeleton className={skel.headCell} style={{ width: "5rem" }} /></TableHead>
          <TableHead><Skeleton className={skel.headCell} style={{ width: "3.5rem" }} /></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: rows }).map((_, i) => (
          <TableRow key={i}>
            <TableCell><Skeleton className={skel.cellName} /></TableCell>
            <TableCell><Skeleton className={skel.cellLrn} /></TableCell>
            <TableCell><Skeleton className={skel.cellNum} /></TableCell>
            <TableCell><Skeleton className={skel.cellNum} /></TableCell>
            <TableCell className={subjectStyles.riskCell}>
              <Skeleton className={skel.badgeSlot} style={{ margin: "0 auto" }} />
            </TableCell>
            <TableCell><Skeleton className={skel.cellRemarks} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
