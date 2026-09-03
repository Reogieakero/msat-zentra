import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../app/constants/app_colors.dart';
import '../../../data/models/student_model.dart';
import '../../../data/models/attendance_model.dart';
import '../../../data/models/grade_model.dart';

class StatusBadge extends StatelessWidget {
  final String label;
  final Color color;
  final Color? textColor;

  const StatusBadge({
    super.key,
    required this.label,
    required this.color,
    this.textColor,
  });

  factory StatusBadge.risk(RiskLevel level) {
    switch (level) {
      case RiskLevel.High:
        return const StatusBadge(label: 'HIGH RISK', color: AppColors.riskHigh);
      case RiskLevel.Moderate:
        return const StatusBadge(label: 'MODERATE RISK', color: AppColors.riskModerate);
      case RiskLevel.Low:
        return const StatusBadge(label: 'LOW RISK', color: AppColors.riskLow);
    }
  }

  factory StatusBadge.attendance(AttendanceStatus status) {
    switch (status) {
      case AttendanceStatus.present:
        return const StatusBadge(label: 'PRESENT', color: AppColors.attendancePresent);
      case AttendanceStatus.absent:
        return const StatusBadge(label: 'ABSENT', color: AppColors.attendanceAbsent);
      case AttendanceStatus.late:
        return const StatusBadge(label: 'LATE', color: AppColors.attendanceLate);
      case AttendanceStatus.excused:
        return const StatusBadge(label: 'EXCUSED', color: AppColors.attendanceExcused);
    }
  }

  factory StatusBadge.lockStatus(LockStatus status) {
    switch (status) {
      case LockStatus.unlocked:
        return const StatusBadge(label: 'EDITABLE', color: AppColors.lockUnlocked);
      case LockStatus.locked:
        return const StatusBadge(label: 'LOCKED', color: AppColors.lockLocked);
      case LockStatus.adviser_approved:
        return const StatusBadge(label: 'APPROVED', color: AppColors.lockApproved);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: color.withOpacity(0.4), width: 1),
      ),
      child: Text(
        label,
        style: GoogleFonts.robotoMono(
          color: textColor ?? color,
          fontSize: 11,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
