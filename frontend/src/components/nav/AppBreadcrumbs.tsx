"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

/* Segment labels that title-casing would get wrong. */
const SEGMENT_LABELS: Record<string, string> = {
  adm: "ADM",
  "adm-cases": "ADM",
  sf10: "SF10",
  "sf10-access": "SF10 Access",
  lrn: "LRN",
  "record-keeper": "Record Keeper",
  "final-grades": "Final Grades",
  "grade-flags": "Grade Flags",
  "adviser-access": "Adviser Access",
};

/* Sidebar group ("workspace") each section belongs to, keyed by role + section. */
const WORKSPACE_LABELS: Record<string, string> = {
  "/teacher/overview": "Overview",
  "/teacher/advisory": "Advisory",
  "/teacher/anecdotal": "Advisory",
  "/teacher/classes": "Workspace",
  "/teacher/grading": "Workspace",
  "/teacher/attendance": "Workspace",
  "/teacher/schedule": "Workspace",
  "/teacher/settings": "Settings",
};

/* Full-path labels for tab pages whose sidebar name differs from the URL. */
const PATH_LABELS: Record<string, string> = {
  "/teacher/overview": "Dashboard",
  "/teacher/advisory/list": "Advisory List",
  "/teacher/advisory/students": "Students",
  "/teacher/advisory/attendance": "Attendance",
  "/teacher/advisory/referrals": "Referrals",
  "/teacher/advisory/adm-cases": "ADM Cases",
  "/teacher/advisory/schedule": "Class Schedule",
  "/teacher/advisory/sf10-access": "SF10 Access",
};

/* Sections without an index page link to their default tab instead of 404ing. */
const PATH_HREFS: Record<string, string> = {
  "/teacher/advisory": "/teacher/advisory/list",
};

const DYNAMIC_SEGMENT =
  /^(\[.+\]|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+)$/i;

/* Dynamic leaves read better named after the page that owns them. */
const DYNAMIC_PARENT_LABELS: Record<string, string> = {
  grading: "Assessment",
  students: "Student",
  folders: "Folder",
  "adm-cases": "Monitor",
};

function humanize(segment: string, parent: string | undefined): string {
  const decoded = decodeURIComponent(segment);
  const known = SEGMENT_LABELS[decoded.toLowerCase()];
  if (known) return known;
  if (DYNAMIC_SEGMENT.test(decoded)) {
    return (parent && DYNAMIC_PARENT_LABELS[parent]) ?? "Details";
  }
  return decoded
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Topbar breadcrumb for every role shell: role name → active page → nested
 * page/tab path. Intermediate crumbs link back; the last one is the current
 * page. Hidden below `lg` so the topbar controls keep their space.
 */
export function AppBreadcrumbs({
  role,
  className,
}: {
  role: string;
  className?: string;
}) {
  const pathname = usePathname() ?? "";
  const segments = pathname.split("/").filter(Boolean);

  const resolved = segments.slice(1).map((segment, index, list) => {
    const path = `/${segments[0]}/${list.slice(0, index + 1).join("/")}`;
    return {
      href: PATH_HREFS[path] ?? path,
      label: PATH_LABELS[path] ?? humanize(segment, list[index - 1]),
    };
  });

  // A section alias can resolve to the same URL as its child tab (e.g.
  // `/teacher/advisory` → `/teacher/advisory/list`), which would render two
  // crumbs with the same key. Keep only the last crumb for each href.
  const crumbs = resolved.filter(
    (crumb, index) =>
      resolved.findIndex((other, i) => i > index && other.href === crumb.href) === -1
  );

  const workspace = WORKSPACE_LABELS[`/${segments[0]}/${segments[1]}`];

  return (
    <Breadcrumb
      className={cn(
        // Spaced away from the brand (Gap + divider) and locked to Inter.
        "ml-6 hidden min-w-0 border-l border-border/60 pl-5 xl:block",
        "[font-family:var(--font-inter),ui-sans-serif,system-ui,sans-serif]",
        className
      )}
    >
      <BreadcrumbList className="flex-nowrap gap-1 text-[12px]">
        <BreadcrumbItem className="shrink-0">
          {crumbs.length === 0 ? (
            <BreadcrumbPage className="font-semibold">{role}</BreadcrumbPage>
          ) : (
            // The role is the desk root, not a page — keep it as plain text so
            // clicking it never redirects (teacher has no `/teacher` page).
            <span className="font-semibold text-foreground">{role}</span>
          )}
        </BreadcrumbItem>
        {workspace && workspace !== crumbs[0]?.label && (
          <>
            <BreadcrumbSeparator className="[&>svg]:size-3" />
            {/* Workspace groups have no page of their own — plain text. */}
            <BreadcrumbItem className="shrink-0">
              <span className="font-semibold text-muted-foreground">{workspace}</span>
            </BreadcrumbItem>
          </>
        )}
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <React.Fragment key={crumb.href}>
              <BreadcrumbSeparator className="[&>svg]:size-3" />
              <BreadcrumbItem className="min-w-0">
                {last ? (
                  <BreadcrumbPage className="max-w-[11rem] truncate font-semibold">
                    {crumb.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={crumb.href} className="max-w-[8rem] truncate font-semibold">
                      {crumb.label}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
