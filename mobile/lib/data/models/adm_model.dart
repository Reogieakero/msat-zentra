import 'package:flutter/material.dart';

enum AdmStage {
  anecdotal,
  consultation,
  meeting_parents,
  home_visitation,
  certification,
  principal_approval,
  enrollment_monitoring,
  completion,
}

extension AdmStageExtension on AdmStage {
  String get displayName {
    switch (this) {
      case AdmStage.anecdotal:
        return '1. Anecdotal';
      case AdmStage.consultation:
        return '2. Consultation';
      case AdmStage.meeting_parents:
        return '3. Parent Meeting';
      case AdmStage.home_visitation:
        return '4. Home Visitation';
      case AdmStage.certification:
        return '5. Certification';
      case AdmStage.principal_approval:
        return '6. Principal Approval';
      case AdmStage.enrollment_monitoring:
        return '7. Monitoring';
      case AdmStage.completion:
        return '8. Completion';
    }
  }

  int get stageIndex => index + 1;
}

enum AdmStatus {
  referred('Referred for ADM'),
  pendingApproval('Pending Evaluation'),
  enrolled('Officially Enrolled'),
  completed('Intervention Completed');

  final String label;
  const AdmStatus(this.label);
}

class AdmSubjectModuleModel {
  final String id;
  final String subjectName;
  final String moduleTitle;
  final String fileName;
  final String fileSize;
  final String assignedTeacher;
  final DateTime dueDate;
  final bool isSubmitted;

  const AdmSubjectModuleModel({
    required this.id,
    required this.subjectName,
    required this.moduleTitle,
    required this.fileName,
    required this.fileSize,
    required this.assignedTeacher,
    required this.dueDate,
    this.isSubmitted = false,
  });

  AdmSubjectModuleModel copyWith({
    bool? isSubmitted,
  }) {
    return AdmSubjectModuleModel(
      id: id,
      subjectName: subjectName,
      moduleTitle: moduleTitle,
      fileName: fileName,
      fileSize: fileSize,
      assignedTeacher: assignedTeacher,
      dueDate: dueDate,
      isSubmitted: isSubmitted ?? this.isSubmitted,
    );
  }
}

class AdmLearnerModel {
  final String id;
  final String studentId;
  final String studentName;
  final String lrn;
  final String sectionName;
  final AdmStage stage;
  final AdmStatus status;
  final DateTime createdAt;
  final int pendingModulesCount;
  final int completedModulesCount;
  final String? issuedDevice;
  final String? referredByTeacher;

  const AdmLearnerModel({
    required this.id,
    required this.studentId,
    required this.studentName,
    required this.lrn,
    required this.sectionName,
    required this.stage,
    this.status = AdmStatus.enrolled,
    required this.createdAt,
    this.pendingModulesCount = 0,
    this.completedModulesCount = 0,
    this.issuedDevice,
    this.referredByTeacher,
  });

  AdmLearnerModel copyWith({
    AdmStage? stage,
    AdmStatus? status,
    int? pendingModulesCount,
    int? completedModulesCount,
    String? issuedDevice,
    String? referredByTeacher,
  }) {
    return AdmLearnerModel(
      id: id,
      studentId: studentId,
      studentName: studentName,
      lrn: lrn,
      sectionName: sectionName,
      stage: stage ?? this.stage,
      status: status ?? this.status,
      createdAt: createdAt,
      pendingModulesCount: pendingModulesCount ?? this.pendingModulesCount,
      completedModulesCount: completedModulesCount ?? this.completedModulesCount,
      issuedDevice: issuedDevice ?? this.issuedDevice,
      referredByTeacher: referredByTeacher ?? this.referredByTeacher,
    );
  }
}

class AdmDeviceModel {
  final String id;
  final String studentName;
  final String deviceType;
  final String deviceSerial;
  final DateTime issuedDate;
  final bool isReturned;

  const AdmDeviceModel({
    required this.id,
    required this.studentName,
    required this.deviceType,
    required this.deviceSerial,
    required this.issuedDate,
    this.isReturned = false,
  });
}

enum AdmClassworkType {
  assignment('Assignment', Icons.assignment_outlined),
  quiz('Quiz / Assessment', Icons.quiz_outlined),
  activitySheet('Activity Sheet', Icons.description_outlined),
  project('Intervention Project', Icons.architecture_outlined);

  final String label;
  final IconData icon;
  const AdmClassworkType(this.label, this.icon);
}

class AdmClassworkModel {
  final String id;
  final String subjectName;
  final String title;
  final String topic;
  final AdmClassworkType type;
  final int totalPoints;
  final DateTime dueDate;
  final int assignedCount;
  final int submittedCount;
  final int gradedCount;
  final String instructions;
  final bool isSubmitted;

  const AdmClassworkModel({
    required this.id,
    required this.subjectName,
    required this.title,
    required this.topic,
    required this.type,
    required this.totalPoints,
    required this.dueDate,
    this.assignedCount = 0,
    this.submittedCount = 0,
    this.gradedCount = 0,
    required this.instructions,
    this.isSubmitted = false,
  });

  AdmClassworkModel copyWith({
    String? title,
    String? topic,
    AdmClassworkType? type,
    int? totalPoints,
    DateTime? dueDate,
    int? assignedCount,
    int? submittedCount,
    int? gradedCount,
    String? instructions,
    bool? isSubmitted,
  }) {
    return AdmClassworkModel(
      id: id,
      subjectName: subjectName,
      title: title ?? this.title,
      topic: topic ?? this.topic,
      type: type ?? this.type,
      totalPoints: totalPoints ?? this.totalPoints,
      dueDate: dueDate ?? this.dueDate,
      assignedCount: assignedCount ?? this.assignedCount,
      submittedCount: submittedCount ?? this.submittedCount,
      gradedCount: gradedCount ?? this.gradedCount,
      instructions: instructions ?? this.instructions,
      isSubmitted: isSubmitted ?? this.isSubmitted,
    );
  }
}

