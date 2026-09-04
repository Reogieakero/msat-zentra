export interface ScheduleBlock {
  subject: string;
  section: string;
  room: string;
  day: number; // 1 = Mon ... 5 = Fri
  startMin: number; // minutes from SCHOOL_START (7:30 AM)
  endMin: number; // minutes from SCHOOL_START (7:30 AM)
  color: string;
  activity: string; // e.g. Quiz, Lecture, Seatwork
  topic: string; // e.g. Quiz: Algebraic Expressions
}

export interface TimelineSlot {
  offset: number; // minutes from SCHOOL_START
  label: string; // e.g. "8:30 AM"
}

export const WEEK_LABELS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri"];
export const WEEK_LABELS_FULL = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
];
export const WEEK_DATES = [
  "Sep 7, 2026",
  "Sep 8, 2026",
  "Sep 9, 2026",
  "Sep 10, 2026",
  "Sep 11, 2026",
];

// School day: morning session 7:30 AM – 11:30 AM, lunch break 11:30 AM – 1:00 PM,
// afternoon session 1:00 PM – 5:00 PM.
export const SCHOOL_START = 7 * 60 + 30; // 7:30 AM
export const SCHOOL_END = 17 * 60; // 5:00 PM
export const HOUR_HEIGHT = 56; // px per hour

// Time labels: hourly from 7:30 through 11:30 (morning), then 1:00–5:00 (afternoon).
export const TIMELINE: TimelineSlot[] = [
  { offset: 0, label: "7:30 AM" },
  { offset: 60, label: "8:30 AM" },
  { offset: 120, label: "9:30 AM" },
  { offset: 180, label: "10:30 AM" },
  { offset: 240, label: "11:30 AM" },
  { offset: 330, label: "1:00 PM" },
  { offset: 390, label: "2:00 PM" },
  { offset: 450, label: "3:00 PM" },
  { offset: 510, label: "4:00 PM" },
  { offset: 570, label: "5:00 PM" },
];

// Lunch break spans 11:30 AM (240) to 1:00 PM (330).
export const LUNCH_START = 240;
export const LUNCH_END = 330;

function fmtWall(offsetMin: number): string {
  const wall = SCHOOL_START + offsetMin;
  const h24 = Math.floor(wall / 60);
  const m = wall % 60;
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

export function formatBlockTime(startMin: number, endMin: number): string {
  return `${fmtWall(startMin)} – ${fmtWall(endMin)}`;
}

// Agenda template per activity type (mock only).
export const ACTIVITY_AGENDA: Record<string, string[]> = {
  Quiz: [
    "Attendance & quiz instructions (5 min)",
    "Quiz proper (35 min)",
    "Checking & recording of scores (15 min)",
    "Assignment (5 min)",
  ],
  Lecture: [
    "Attendance & recap (5 min)",
    "Lesson discussion (30 min)",
    "Board work & examples (15 min)",
    "Assignment (10 min)",
  ],
  Seatwork: [
    "Attendance & instructions (5 min)",
    "Guided practice (15 min)",
    "Independent seatwork (30 min)",
    "Checking (10 min)",
  ],
  "Group Activity": [
    "Attendance & grouping (10 min)",
    "Group task (30 min)",
    "Group reporting (15 min)",
    "Synthesis (5 min)",
  ],
  "Lab Work": [
    "Attendance & safety briefing (10 min)",
    "Experiment proper (35 min)",
    "Cleanup & write-up (15 min)",
  ],
  Recitation: [
    "Attendance & warm-up (5 min)",
    "Individual recitation (40 min)",
    "Feedback (10 min)",
    "Assignment (5 min)",
  ],
  Review: [
    "Attendance & recap (5 min)",
    "Guided review (30 min)",
    "Q&A (15 min)",
    "Assignment (10 min)",
  ],
  "Hands-on": [
    "Attendance & demo (10 min)",
    "Hands-on activity (35 min)",
    "Showcase & cleanup (15 min)",
  ],
  Presentation: [
    "Attendance & setup (10 min)",
    "Presentations (35 min)",
    "Feedback & grading (15 min)",
  ],
  Drill: [
    "Attendance & warm-up (10 min)",
    "Drill proper (35 min)",
    "Cool down & remarks (15 min)",
  ],
};

export const WEEK_SCHEDULE: ScheduleBlock[] = [
  // Monday
  { subject: "Math 7", section: "G7-A", room: "Rm 201", day: 1, startMin: 0, endMin: 60, color: "#2563eb", activity: "Quiz", topic: "Quiz: Algebraic Expressions" },
  { subject: "English 7", section: "G7-A", room: "Rm 204", day: 1, startMin: 60, endMin: 120, color: "#7c3aed", activity: "Lecture", topic: "Subject-Verb Agreement" },
  { subject: "Science 7", section: "G7-A", room: "Science Lab", day: 1, startMin: 120, endMin: 180, color: "#16a34a", activity: "Lab Work", topic: "Parts of the Microscope" },
  { subject: "PE 7", section: "G7-A", room: "Gym", day: 1, startMin: 180, endMin: 240, color: "#ea580c", activity: "Drill", topic: "Basketball Dribbling Drills" },
  { subject: "Math 7", section: "G7-A", room: "Rm 201", day: 1, startMin: 330, endMin: 390, color: "#2563eb", activity: "Seatwork", topic: "Solving Linear Equations" },
  { subject: "English 7", section: "G7-A", room: "Rm 204", day: 1, startMin: 390, endMin: 450, color: "#7c3aed", activity: "Group Activity", topic: "Reading Comprehension Circles" },
  { subject: "Science 7", section: "G7-A", room: "Science Lab", day: 1, startMin: 450, endMin: 510, color: "#16a34a", activity: "Review", topic: "Matter & Its States Review" },
  { subject: "Arts 7", section: "G7-A", room: "Rm 210", day: 1, startMin: 510, endMin: 570, color: "#db2777", activity: "Hands-on", topic: "Color Theory & Mixing" },

  // Tuesday
  { subject: "English 7", section: "G7-A", room: "Rm 204", day: 2, startMin: 0, endMin: 60, color: "#7c3aed", activity: "Recitation", topic: "Vocabulary Recitation" },
  { subject: "Math 7", section: "G7-A", room: "Rm 201", day: 2, startMin: 60, endMin: 120, color: "#2563eb", activity: "Lecture", topic: "Integers & the Number Line" },
  { subject: "Science 7", section: "G7-A", room: "Science Lab", day: 2, startMin: 120, endMin: 180, color: "#16a34a", activity: "Lecture", topic: "Ecosystems & Food Chains" },
  { subject: "Music 7", section: "G7-A", room: "Music Rm", day: 2, startMin: 180, endMin: 240, color: "#0891b2", activity: "Hands-on", topic: "Rhythm & Beat Practice" },
  { subject: "Science 7", section: "G7-A", room: "Science Lab", day: 2, startMin: 330, endMin: 390, color: "#16a34a", activity: "Quiz", topic: "Quiz: Lab Safety" },
  { subject: "Math 7", section: "G7-A", room: "Rm 201", day: 2, startMin: 390, endMin: 450, color: "#2563eb", activity: "Group Activity", topic: "Fractions Group Challenge" },
  { subject: "English 7", section: "G7-A", room: "Rm 204", day: 2, startMin: 450, endMin: 510, color: "#7c3aed", activity: "Seatwork", topic: "Grammar Worksheet" },
  { subject: "PE 7", section: "G7-A", room: "Gym", day: 2, startMin: 510, endMin: 570, color: "#ea580c", activity: "Hands-on", topic: "Volleyball Basics" },

  // Wednesday
  { subject: "Science 7", section: "G7-A", room: "Science Lab", day: 3, startMin: 0, endMin: 60, color: "#16a34a", activity: "Lecture", topic: "The Water Cycle" },
  { subject: "Math 7", section: "G7-A", room: "Rm 201", day: 3, startMin: 60, endMin: 120, color: "#2563eb", activity: "Quiz", topic: "Quiz: Ratios & Proportions" },
  { subject: "English 7", section: "G7-A", room: "Rm 204", day: 3, startMin: 120, endMin: 180, color: "#7c3aed", activity: "Lecture", topic: "Essay Writing: Introductions" },
  { subject: "Arts 7", section: "G7-A", room: "Rm 210", day: 3, startMin: 180, endMin: 240, color: "#db2777", activity: "Hands-on", topic: "Sketching & Shading" },
  { subject: "Math 7", section: "G7-A", room: "Rm 201", day: 3, startMin: 330, endMin: 390, color: "#2563eb", activity: "Review", topic: "Midweek Review Drill" },
  { subject: "English 7", section: "G7-A", room: "Rm 204", day: 3, startMin: 390, endMin: 450, color: "#7c3aed", activity: "Presentation", topic: "Book Report Presentations" },
  { subject: "Science 7", section: "G7-A", room: "Science Lab", day: 3, startMin: 450, endMin: 510, color: "#16a34a", activity: "Lab Work", topic: "Simple Experiments: Density" },
  { subject: "Music 7", section: "G7-A", room: "Music Rm", day: 3, startMin: 510, endMin: 570, color: "#0891b2", activity: "Recitation", topic: "Note Reading Recitation" },

  // Thursday
  { subject: "Math 7", section: "G7-A", room: "Rm 201", day: 4, startMin: 0, endMin: 60, color: "#2563eb", activity: "Lecture", topic: "Geometry: Angles" },
  { subject: "Science 7", section: "G7-A", room: "Science Lab", day: 4, startMin: 60, endMin: 120, color: "#16a34a", activity: "Group Activity", topic: "Energy Sources Group Work" },
  { subject: "English 7", section: "G7-A", room: "Rm 204", day: 4, startMin: 120, endMin: 180, color: "#7c3aed", activity: "Quiz", topic: "Quiz: Spelling & Vocabulary" },
  { subject: "PE 7", section: "G7-A", room: "Gym", day: 4, startMin: 180, endMin: 240, color: "#ea580c", activity: "Drill", topic: "Track & Field: Sprints" },
  { subject: "English 7", section: "G7-A", room: "Rm 204", day: 4, startMin: 330, endMin: 390, color: "#7c3aed", activity: "Lecture", topic: "Literature: Short Story" },
  { subject: "Science 7", section: "G7-A", room: "Science Lab", day: 4, startMin: 390, endMin: 450, color: "#16a34a", activity: "Seatwork", topic: "Forces & Motion Worksheet" },
  { subject: "Math 7", section: "G7-A", room: "Rm 201", day: 4, startMin: 450, endMin: 510, color: "#2563eb", activity: "Hands-on", topic: "Measuring Angles Activity" },
  { subject: "Arts 7", section: "G7-A", room: "Rm 210", day: 4, startMin: 510, endMin: 570, color: "#db2777", activity: "Presentation", topic: "Art Portfolio Sharing" },

  // Friday
  { subject: "English 7", section: "G7-A", room: "Rm 204", day: 5, startMin: 0, endMin: 60, color: "#7c3aed", activity: "Review", topic: "Weekly Grammar Review" },
  { subject: "Science 7", section: "G7-A", room: "Science Lab", day: 5, startMin: 60, endMin: 120, color: "#16a34a", activity: "Quiz", topic: "Quiz: Cells & Organelles" },
  { subject: "Math 7", section: "G7-A", room: "Rm 201", day: 5, startMin: 120, endMin: 180, color: "#2563eb", activity: "Lecture", topic: "Word Problems" },
  { subject: "Music 7", section: "G7-A", room: "Music Rm", day: 5, startMin: 180, endMin: 240, color: "#0891b2", activity: "Presentation", topic: "Group Song Performance" },
  { subject: "PE 7", section: "G7-A", room: "Gym", day: 5, startMin: 330, endMin: 390, color: "#ea580c", activity: "Hands-on", topic: "Fun Games Friday" },
  { subject: "Math 7", section: "G7-A", room: "Rm 201", day: 5, startMin: 390, endMin: 450, color: "#2563eb", activity: "Seatwork", topic: "Weekend Assignment" },
  { subject: "Science 7", section: "G7-A", room: "Science Lab", day: 5, startMin: 450, endMin: 510, color: "#16a34a", activity: "Review", topic: "Week Recap & Q&A" },
  { subject: "English 7", section: "G7-A", room: "Rm 204", day: 5, startMin: 510, endMin: 570, color: "#7c3aed", activity: "Hands-on", topic: "Speech Practice" },
];
