enum UserRole {
  student,
  parent,
  subject_teacher,
  adviser,
  nurse,
  adm_coordinator,
  guidance_counselor,
  record_keeper,
  registrar,
  principal,
}

extension UserRoleExtension on UserRole {
  String get displayName {
    switch (this) {
      case UserRole.student:
        return 'Student';
      case UserRole.parent:
        return 'Parent / Guardian';
      case UserRole.subject_teacher:
        return 'Subject Teacher';
      case UserRole.adviser:
        return 'Class Adviser';
      case UserRole.nurse:
        return 'School Nurse';
      case UserRole.adm_coordinator:
        return 'ADM Coordinator';
      case UserRole.guidance_counselor:
        return 'Guidance Counselor';
      case UserRole.record_keeper:
        return 'Record Keeper';
      case UserRole.registrar:
        return 'Registrar';
      case UserRole.principal:
        return 'Principal';
    }
  }

  bool get isTeacherOrAdviser => this == UserRole.subject_teacher || this == UserRole.adviser;
  bool get isAdmCoordinator => this == UserRole.adm_coordinator;
  bool get isParent => this == UserRole.parent;
  bool get isStudent => this == UserRole.student;
}

class UserModel {
  final String id;
  final String email;
  final String fullName;
  final UserRole role;
  final String? contactNumber;
  final String? lrn;
  final String? sectionName;
  final String? gradeLevel;

  const UserModel({
    required this.id,
    required this.email,
    required this.fullName,
    required this.role,
    this.contactNumber,
    this.lrn,
    this.sectionName,
    this.gradeLevel,
  });
}
