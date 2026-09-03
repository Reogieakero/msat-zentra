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

class AdmLearnerModel {
  final String id;
  final String studentId;
  final String studentName;
  final String lrn;
  final String sectionName;
  final AdmStage stage;
  final DateTime createdAt;
  final int pendingModulesCount;
  final int completedModulesCount;
  final String? issuedDevice;

  const AdmLearnerModel({
    required this.id,
    required this.studentId,
    required this.studentName,
    required this.lrn,
    required this.sectionName,
    required this.stage,
    required this.createdAt,
    this.pendingModulesCount = 0,
    this.completedModulesCount = 0,
    this.issuedDevice,
  });

  AdmLearnerModel copyWith({
    AdmStage? stage,
    int? pendingModulesCount,
    int? completedModulesCount,
    String? issuedDevice,
  }) {
    return AdmLearnerModel(
      id: id,
      studentId: studentId,
      studentName: studentName,
      lrn: lrn,
      sectionName: sectionName,
      stage: stage ?? this.stage,
      createdAt: createdAt,
      pendingModulesCount: pendingModulesCount ?? this.pendingModulesCount,
      completedModulesCount: completedModulesCount ?? this.completedModulesCount,
      issuedDevice: issuedDevice ?? this.issuedDevice,
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
