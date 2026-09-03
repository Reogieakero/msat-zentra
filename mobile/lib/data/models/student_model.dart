enum GradeLevel { G7, G8, G9, G10, G11, G12 }

enum RiskLevel { Low, Moderate, High }

class StudentModel {
  final String id;
  final String lrn;
  final String fullName;
  final GradeLevel gradeLevel;
  final String sectionId;
  final String sectionName;
  final RiskLevel riskLevel;
  final int riskCount;
  final String? photoUrl;
  final String? parentName;

  const StudentModel({
    required this.id,
    required this.lrn,
    required this.fullName,
    required this.gradeLevel,
    required this.sectionId,
    required this.sectionName,
    this.riskLevel = RiskLevel.Low,
    this.riskCount = 0,
    this.photoUrl,
    this.parentName,
  });
}
