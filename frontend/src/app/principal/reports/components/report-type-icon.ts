import {
  TrendingUp,
  Activity,
  Grid3x3,
  Award,
  type LucideIcon,
} from "lucide-react";
import type { ReportType } from "../reports-data";

export const REPORT_TYPE_ICON: Record<ReportType, LucideIcon> = {
  trends: TrendingUp,
  intervention_success: Activity,
  heat_map: Grid3x3,
  honor_roll: Award,
};
