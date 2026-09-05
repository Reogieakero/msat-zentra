import '../models/user_model.dart';
import '../models/student_model.dart';
import '../models/grade_model.dart';
import '../models/attendance_model.dart';
import '../models/adm_model.dart';
import '../models/anecdotal_model.dart';
import '../models/teacher_class_model.dart';

class MockData {
  MockData._();

  // Active Mock Users for Role Switcher Demo
  static const UserModel teacherUser = UserModel(
    id: 'usr_teacher_01',
    email: 'adviser.santos@msat.edu.ph',
    fullName: 'Maria Santos (Adviser)',
    role: UserRole.adviser,
    sectionName: 'G10 - Emerald',
    gradeLevel: 'G10',
  );

  static const UserModel admCoordinatorUser = UserModel(
    id: 'usr_adm_01',
    email: 'adm.coordinator@msat.edu.ph',
    fullName: 'Juan Dela Cruz (ADM Coord)',
    role: UserRole.adm_coordinator,
  );

  static const UserModel parentUser = UserModel(
    id: 'usr_parent_01',
    email: 'parent.reyes@gmail.com',
    fullName: 'Elena Reyes (Parent)',
    role: UserRole.parent,
  );

  static const UserModel studentUser = UserModel(
    id: 'usr_student_01',
    email: 'carlos.reyes@student.msat.edu.ph',
    fullName: 'Carlos Reyes (Student)',
    role: UserRole.student,
    lrn: '109283746501',
    sectionName: 'G10 - Emerald',
    gradeLevel: 'G10',
  );

  // Assigned Classes for Adviser Maria Santos
  static final List<TeacherClassModel> teacherClasses = [
    const TeacherClassModel(
      id: 'cls_01',
      sectionId: 'sec_g10_emerald',
      sectionName: 'G10 - Emerald',
      gradeLevel: 'Grade 10',
      subjectName: 'Mathematics 10',
      subjectCode: 'MATH10',
      scheduleTime: '07:30 AM - 08:30 AM',
      room: 'Room 204',
      studentCount: 42,
      isAdviser: true,
      isAttendanceMarkedToday: true,
      isGradesLocked: false,
    ),
    const TeacherClassModel(
      id: 'cls_02',
      sectionId: 'sec_g9_sapphire',
      sectionName: 'G9 - Sapphire',
      gradeLevel: 'Grade 9',
      subjectName: 'Mathematics 9',
      subjectCode: 'MATH09',
      scheduleTime: '08:30 AM - 09:30 AM',
      room: 'Room 102',
      studentCount: 38,
      isAdviser: false,
      isAttendanceMarkedToday: false,
      isGradesLocked: false,
    ),
    const TeacherClassModel(
      id: 'cls_03',
      sectionId: 'sec_g11_stem_a',
      sectionName: 'G11 - STEM A',
      gradeLevel: 'Grade 11',
      subjectName: 'General Mathematics 11',
      subjectCode: 'GENMATH11',
      scheduleTime: '10:00 AM - 11:00 AM',
      room: 'Science Lab B',
      studentCount: 35,
      isAdviser: false,
      isAttendanceMarkedToday: true,
      isGradesLocked: true,
    ),
    const TeacherClassModel(
      id: 'cls_04',
      sectionId: 'sec_g10_emerald',
      sectionName: 'G10 - Emerald',
      gradeLevel: 'Grade 10',
      subjectName: 'Advisory Homeroom',
      subjectCode: 'ADV10',
      scheduleTime: '01:00 PM - 02:00 PM',
      room: 'Room 204',
      studentCount: 42,
      isAdviser: true,
      isAttendanceMarkedToday: false,
      isGradesLocked: false,
    ),
  ];

  // Section Students
  static final List<StudentModel> students = [
    const StudentModel(
      id: 'std_01',
      lrn: '109283746501',
      fullName: 'Carlos Reyes',
      gradeLevel: GradeLevel.G10,
      sectionId: 'sec_g10_emerald',
      sectionName: 'G10 - Emerald',
      riskLevel: RiskLevel.Moderate,
      riskCount: 2,
      parentName: 'Elena Reyes',
    ),
    const StudentModel(
      id: 'std_02',
      lrn: '109283746502',
      fullName: 'Ana Lim',
      gradeLevel: GradeLevel.G10,
      sectionId: 'sec_g10_emerald',
      sectionName: 'G10 - Emerald',
      riskLevel: RiskLevel.Low,
      riskCount: 0,
      parentName: 'Robert Lim',
    ),
    const StudentModel(
      id: 'std_03',
      lrn: '109283746503',
      fullName: 'Mark Tan',
      gradeLevel: GradeLevel.G10,
      sectionId: 'sec_g10_emerald',
      sectionName: 'G10 - Emerald',
      riskLevel: RiskLevel.High,
      riskCount: 3,
      parentName: 'Grace Tan',
    ),
    const StudentModel(
      id: 'std_04',
      lrn: '109283746504',
      fullName: 'Bea Garcia',
      gradeLevel: GradeLevel.G10,
      sectionId: 'sec_g10_emerald',
      sectionName: 'G10 - Emerald',
      riskLevel: RiskLevel.Low,
      riskCount: 0,
      parentName: 'Joseph Garcia',
    ),
    const StudentModel(
      id: 'std_05',
      lrn: '109283746505',
      fullName: 'David Ramos',
      gradeLevel: GradeLevel.G10,
      sectionId: 'sec_g10_emerald',
      sectionName: 'G10 - Emerald',
      riskLevel: RiskLevel.Low,
      riskCount: 1,
      parentName: 'Sonia Ramos',
    ),
  ];

  // Assessments for Subject: Mathematics G10
  static final List<AssessmentModel> mathAssessments = [
    AssessmentModel(
      id: 'asm_ww1',
      title: 'WW1: Polynomials',
      componentType: ComponentType.WRITTEN_WORK,
      maxScore: 20.0,
      dateGiven: DateTime.now().subtract(const Duration(days: 20)),
    ),
    AssessmentModel(
      id: 'asm_ww2',
      title: 'WW2: Circles',
      componentType: ComponentType.WRITTEN_WORK,
      maxScore: 25.0,
      dateGiven: DateTime.now().subtract(const Duration(days: 14)),
    ),
    AssessmentModel(
      id: 'asm_pt1',
      title: 'PT1: Geometric Construction',
      componentType: ComponentType.PERFORMANCE_TASK,
      maxScore: 50.0,
      dateGiven: DateTime.now().subtract(const Duration(days: 10)),
    ),
    AssessmentModel(
      id: 'asm_qe1',
      title: 'QE1: First Quarter Exam',
      componentType: ComponentType.QUARTERLY_EXAM,
      maxScore: 60.0,
      dateGiven: DateTime.now().subtract(const Duration(days: 2)),
    ),
  ];

  // Initial Student Raw Grades Map [studentId_assessmentId -> rawScore]
  static final Map<String, double> initialRawGrades = {
    'std_01_asm_ww1': 16.0,
    'std_01_asm_ww2': 18.0,
    'std_01_asm_pt1': 38.0,
    'std_01_asm_qe1': 42.0,
    'std_02_asm_ww1': 19.0,
    'std_02_asm_ww2': 24.0,
    'std_02_asm_pt1': 48.0,
    'std_02_asm_qe1': 55.0,
    'std_03_asm_ww1': 10.0,
    'std_03_asm_ww2': 12.0,
    'std_03_asm_pt1': 25.0,
    'std_03_asm_qe1': 30.0,
    'std_04_asm_ww1': 20.0,
    'std_04_asm_ww2': 23.0,
    'std_04_asm_pt1': 46.0,
    'std_04_asm_qe1': 52.0,
    'std_05_asm_ww1': 15.0,
    'std_05_asm_ww2': 20.0,
    'std_05_asm_pt1': 40.0,
    'std_05_asm_qe1': 45.0,
  };

  // Mock ADM Learners
  static final List<AdmLearnerModel> admLearners = [
    AdmLearnerModel(
      id: 'adm_01',
      studentId: 'std_03',
      studentName: 'Mark Tan',
      lrn: '109283746503',
      sectionName: 'G10 - Emerald',
      stage: AdmStage.meeting_parents,
      createdAt: DateTime.now().subtract(const Duration(days: 15)),
      pendingModulesCount: 3,
      completedModulesCount: 1,
      issuedDevice: 'Tablet #MSAT-T-104',
    ),
    AdmLearnerModel(
      id: 'adm_02',
      studentId: 'std_01',
      studentName: 'Carlos Reyes',
      lrn: '109283746501',
      sectionName: 'G10 - Emerald',
      stage: AdmStage.consultation,
      createdAt: DateTime.now().subtract(const Duration(days: 7)),
      pendingModulesCount: 2,
      completedModulesCount: 2,
      issuedDevice: null,
    ),
    AdmLearnerModel(
      id: 'adm_03',
      studentId: 'std_06',
      studentName: 'Gabriel Aquino',
      lrn: '109283746509',
      sectionName: 'G9 - Sapphire',
      stage: AdmStage.enrollment_monitoring,
      createdAt: DateTime.now().subtract(const Duration(days: 30)),
      pendingModulesCount: 0,
      completedModulesCount: 5,
      issuedDevice: 'Laptop #MSAT-L-012',
    ),
  ];

  // ADM Devices
  static final List<AdmDeviceModel> admDevices = [
    AdmDeviceModel(
      id: 'dev_01',
      studentName: 'Mark Tan',
      deviceType: 'Samsung Galaxy Tab A8',
      deviceSerial: 'MSAT-T-104',
      issuedDate: DateTime.now().subtract(const Duration(days: 12)),
      isReturned: false,
    ),
    AdmDeviceModel(
      id: 'dev_02',
      studentName: 'Gabriel Aquino',
      deviceType: 'Lenovo Chromebook 300e',
      deviceSerial: 'MSAT-L-012',
      issuedDate: DateTime.now().subtract(const Duration(days: 28)),
      isReturned: false,
    ),
  ];

  // Initial Anecdotal Records
  static final List<AnecdotalRecordModel> anecdotalRecords = [
    AnecdotalRecordModel(
      id: 'anec_01',
      studentId: 'std_03',
      studentName: 'Mark Tan',
      observerName: 'Maria Santos',
      sectionName: 'G10 - Emerald',
      category: AnecdotalCategory.attendance,
      incidentDescription: 'Accumulated 4 consecutive unexcused absences during Period 1.',
      observationDatetime: DateTime.now().subtract(const Duration(days: 3)),
    ),
    AnecdotalRecordModel(
      id: 'anec_02',
      studentId: 'std_01',
      studentName: 'Carlos Reyes',
      observerName: 'Maria Santos',
      sectionName: 'G10 - Emerald',
      category: AnecdotalCategory.academic,
      incidentDescription: 'Struggling with Math QE1 transmuted scores below 75 threshold.',
      observationDatetime: DateTime.now().subtract(const Duration(days: 1)),
    ),
  ];
}
