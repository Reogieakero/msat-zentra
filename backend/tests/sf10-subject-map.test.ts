import { describe, it, expect } from "vitest";
import {
  detectGradeLevelFromText,
  extractRatedSubjectsFromText,
  extractRemark,
  extractSubjectsFromText,
  maxGradeLevel,
  normalizeSubjectName,
  parseClassifiedGrade,
  parseRating,
  splitQuartersFinal,
} from "../src/services/sf10/subject-aliases.js";
import { buildDeficiencyMap, buildSubjectMap, isTaken } from "../src/services/sf10/subject-map.service.js";
import { evaluateFormula } from "../src/services/sf10/formula.service.js";
import { extractXlsxSubjects, extractXlsxText } from "../src/services/sf10/ocr-text.service.js";
import {
  extractIdentityFromCells,
  extractIdentityFromText,
  extractLrn,
  formatLearnerName,
  parseFullName,
} from "../src/services/sf10/learner-identity.service.js";
import { scoreNameMatch } from "../src/services/sf10/learner-match.service.js";

describe("SF10 subject normalizer", () => {
  it("expands common abbreviations", () => {
    expect(normalizeSubjectName("Math 7")).toBe("mathematics");
    expect(normalizeSubjectName("Fil")).toBe("filipino");
    expect(normalizeSubjectName("AP")).toBe("araling panlipunan");
    expect(normalizeSubjectName("ESP")).toBe("edukasyon sa pagpapakatao");
    expect(normalizeSubjectName("TLE")).toBe("technology and livelihood education");
  });

  it("keeps distinct SHS subjects distinct", () => {
    expect(normalizeSubjectName("Oral Communication")).not.toBe(
      normalizeSubjectName("Reading and Writing"),
    );
  });
});

describe("SF10 subject extraction", () => {
  it("finds subjects mentioned in raw OCR text", () => {
    const subjects = extractSubjectsFromText(
      "FORM 137\nMathematics 89\nScience 91\nFilipino 88\nMAPEH 90",
    );
    const norms = subjects.map((s) => s.norm);
    expect(norms).toContain("mathematics");
    expect(norms).toContain("science");
    expect(norms).toContain("filipino");
    expect(norms).toContain("mapeh");
  });

  it("returns empty for blank text (needs-review path)", () => {
    expect(extractSubjectsFromText("")).toEqual([]);
  });
});

describe("SF10 subject map (SF10 vs school catalog)", () => {
  const school = [
    { code: "MATH7", name: "Mathematics" },
    { code: "SCI7", name: "Science" },
    { code: "ENG7", name: "English" },
    { code: "MAPEH7", name: "MAPEH" },
  ];

  it("marks present subjects matched and absent ones missing", () => {
    const map = buildSubjectMap(school, [
      { rawName: "Math", norm: "mathematics" },
      { rawName: "Science", norm: "science" },
    ]);
    expect(map.matched.map((m) => m.code).sort()).toEqual(["MATH7", "SCI7"]);
    expect(map.missing.map((m) => m.code).sort()).toEqual(["ENG7", "MAPEH7"]);
    expect(map.sf10Only).toEqual([]);
  });

  it("flags SF10-only subjects for review", () => {
    const map = buildSubjectMap(school, [
      { rawName: "Mathematics", norm: "mathematics" },
      { rawName: "Robotics", norm: "robotics" },
    ]);
    expect(map.sf10Only.map((s) => s.norm)).toContain("robotics");
    expect(map.needsReview).toBe(true);
  });

  it("tolerates minor OCR typos", () => {
    const map = buildSubjectMap(school, [{ rawName: "Mathematlcs", norm: "mathematlcs" }]);
    expect(map.matched.map((m) => m.code)).toContain("MATH7");
  });

  it("never emits duplicate file-only norms (unique React keys downstream)", () => {
    const map = buildSubjectMap([], [
      { rawName: "Mathematics", norm: "mathematics" },
      { rawName: "Math", norm: "mathematics" },
      { rawName: "English", norm: "english" },
    ]);
    const norms = map.sf10Only.map((s) => s.norm);
    expect(new Set(norms).size).toBe(norms.length);
  });
});

describe("SF10 quarterly history + previous-school subjects", () => {
  it("splits Q1–Q4 and final, ignoring name digits", () => {
    expect(splitQuartersFinal([80, 80, 80, 80, 80])).toEqual({ quarters: [80, 80, 80, 80], final: 80 });
    expect(splitQuartersFinal([89])).toEqual({ quarters: null, final: 89 });
    expect(splitQuartersFinal([])).toEqual({ quarters: null, final: null });
    expect(extractRemark("80 PASSED")).toBe("PASSED");
    expect(extractRemark("Mathematics 89")).toBe(null);
  });

  it("keeps trade electives distinct with their history", () => {
    expect(normalizeSubjectName("TRADE DRAWING 7")).toBe("trade drawing");
    expect(normalizeSubjectName("ICFF 8")).toBe("icf");
    expect(normalizeSubjectName("ENTREPRENEURSHIP 9")).toBe("entrepreneurship");
    const subjects = extractRatedSubjectsFromText(
      "TRADE DRAWING 7 80 80 80 80 80 PASSED\nENTREPRENEURSHIP 9 80 80 80 80 80 PASSED",
    );
    const trade = subjects.find((s) => s.norm === "trade drawing");
    const entrep = subjects.find((s) => s.norm === "entrepreneurship");
    expect(trade).toMatchObject({ rating: 80, quarters: [80, 80, 80, 80], remarks: "PASSED" });
    expect(entrep).toMatchObject({ rating: 80, quarters: [80, 80, 80, 80], remarks: "PASSED" });
  });

  it("records file-only subjects per grade with quarterlies", () => {
    const result = buildDeficiencyMap(
      [{ code: "MATH7", name: "Mathematics", gradeLevel: "G7", category: "CORE" }],
      [
        { rawName: "Mathematics", norm: "mathematics", rating: 84, gradeLevel: "G7", quarters: [84, 84, 82, 87], remarks: "PASSED" },
        { rawName: "Trade Drawing", norm: "trade drawing", rating: 80, gradeLevel: "G7", quarters: [80, 80, 80, 80], remarks: "PASSED" },
      ],
      "G7",
    );
    const g7 = result.perGrade.find((g) => g.gradeLevel === "G7");
    expect(g7?.matched[0]).toMatchObject({ code: "MATH7", quarters: [84, 84, 82, 87], remarks: "PASSED" });
    expect(g7?.extras).toMatchObject([
      { norm: "trade drawing", rating: 80, quarters: [80, 80, 80, 80], remarks: "PASSED" },
    ]);
  });

  it("reads XLSX quarterly columns positionally", async () => {
    const imported = (await import("exceljs")) as unknown as typeof import("exceljs") & {
      default?: typeof import("exceljs");
    };
    const ExcelJS = imported.default ?? imported;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("SF10");
    ws.addRow(["Classified as Grade:", "7"]);
    ws.addRow(["LEARNING AREAS", "1", "2", "3", "4", "FINAL RATING", "REMARKS"]);
    ws.addRow(["ICF 7", 80, 80, 80, 80, 80, "PASSED"]);
    ws.addRow(["TRADE DRAWING 7", 80, 80, 80, 80, 80, "PASSED"]);
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    const { extractXlsxSubjects } = await import("../src/services/sf10/ocr-text.service.js");
    const subjects = await extractXlsxSubjects(buffer);
    const icf = subjects.find((s) => s.norm === "icf");
    const trade = subjects.find((s) => s.norm === "trade drawing");
    expect(icf).toMatchObject({ gradeLevel: "G7", rating: 80, quarters: [80, 80, 80, 80], remarks: "PASSED" });
    expect(trade).toMatchObject({ gradeLevel: "G7", rating: 80, quarters: [80, 80, 80, 80], remarks: "PASSED" });
  });

  it("pins quarterlies to header columns despite merged repetition", async () => {
    const imported = (await import("exceljs")) as unknown as typeof import("exceljs") & {
      default?: typeof import("exceljs");
    };
    const ExcelJS = imported.default ?? imported;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("SF10");
    ws.addRow(["Classified as Grade:", "7"]);
    // Merged spans repeat each label/value across columns, like real SF10 files.
    ws.addRow(["LEARNING AREAS", "1", "1", "1", "1", "2", "2", "2", "2", "3", "3", "3", "3", "4", "4", "4", "FINAL RATING", "FINAL RATING", "REMARKS"]);
    ws.addRow(["English", 80, 80, 80, 80, 84, 84, 84, 84, 81, 81, 81, 81, 85, 85, 85, 83, 83, "PASSED"]);
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    const { extractXlsxSubjects } = await import("../src/services/sf10/ocr-text.service.js");
    const subjects = await extractXlsxSubjects(buffer);
    expect(subjects.find((s) => s.norm === "english")).toMatchObject({
      gradeLevel: "G7",
      rating: 83,
      quarters: [80, 84, 81, 85],
      remarks: "PASSED",
    });
  });

  it("collapses merged repetition without headers", async () => {
    const imported = (await import("exceljs")) as unknown as typeof import("exceljs") & {
      default?: typeof import("exceljs");
    };
    const ExcelJS = imported.default ?? imported;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("SF10");
    ws.addRow(["English", 80, 80, 80, 80, 84, 84, 84, 84, 81, 81, 81, 81, 85, 85, 85, 83, 83, "PASSED"]);
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    const { extractXlsxSubjects } = await import("../src/services/sf10/ocr-text.service.js");
    const subjects = await extractXlsxSubjects(buffer);
    expect(subjects.find((s) => s.norm === "english")).toMatchObject({
      rating: 83,
      quarters: [80, 84, 81, 85],
      remarks: "PASSED",
    });
  });
});

describe("SF10 XLSX extraction (no OCR)", () => {
  it("reads subject names straight from cells", async () => {
    const imported = (await import("exceljs")) as unknown as typeof import("exceljs") & {
      default?: typeof import("exceljs");
    };
    const ExcelJS = imported.default ?? imported;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("SF10");
    ws.addRow(["LEARNING AREAS", "Final Rating"]);
    ws.addRow(["Mathematics", 89]);
    ws.addRow(["Science", 91]);
    ws.addRow(["Filipino", 88]);
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    const text = await extractXlsxText(buffer);
    const norms = extractSubjectsFromText(text).map((s) => s.norm);
    expect(norms).toContain("mathematics");
    expect(norms).toContain("science");
    expect(norms).toContain("filipino");
  });
});

describe("SF10 taken policy (any score counts; 0/blank = not taken)", () => {
  it("treats real scores as taken, 0 and blank as not taken", () => {
    expect(isTaken(75)).toBe(true);
    expect(isTaken(74)).toBe(true);
    expect(isTaken(100)).toBe(true);
    expect(isTaken(0)).toBe(false);
    expect(isTaken(null)).toBe(false);
    expect(isTaken(undefined)).toBe(false);
  });

  it("parses ratings while skipping years and LRN-length numbers", () => {
    expect(parseRating(89)).toBe(89);
    expect(parseRating("")).toBe(null);
    expect(parseRating("2024")).toBe(null);
    expect(parseRating("2024-2025")).toBe(null);
    expect(parseRating("109876543210")).toBe(null);
    expect(parseRating(" 88 ")).toBe(88);
  });

  it("detects grade headers", () => {
    expect(detectGradeLevelFromText("Grade 8")).toBe("G8");
    expect(detectGradeLevelFromText("G9 - Second Year")).toBe("G9");
    expect(detectGradeLevelFromText("VII")).toBe("G7");
    expect(detectGradeLevelFromText("LEARNING AREAS")).toBe(null);
  });

  it("reads 'Classified as Grade' as the scholastic block basis", () => {
    expect(parseClassifiedGrade("Classified as Grade: 7 Section: Aquamarine")).toBe("G7");
    expect(parseClassifiedGrade("CLASSIFIED AS GRADE: 10")).toBe("G10");
    expect(parseClassifiedGrade("Classified as Grade: VII")).toBe("G7");
    expect(parseClassifiedGrade("LEARNING AREAS")).toBe(null);
    expect(parseClassifiedGrade("School Year: 2024-2025")).toBe(null);
    expect(parseClassifiedGrade("LRN: 101456025233")).toBe(null);
    expect(maxGradeLevel(["G7", null, "G9"])).toBe("G9");
    expect(maxGradeLevel([null])).toBe(null);
  });

  it("tags subjects by their classified block", () => {
    const subjects = extractRatedSubjectsFromText(
      "Classified as Grade: 7\nMathematics 84\nMAPEH\nClassified as Grade: 8\nEnglish 88",
    );
    expect(subjects.find((s) => s.norm === "mathematics")?.gradeLevel).toBe("G7");
    expect(subjects.find((s) => s.norm === "mapeh")?.gradeLevel).toBe("G7");
    expect(subjects.find((s) => s.norm === "english")?.gradeLevel).toBe("G8");
  });
});

describe("SF10 per-year deficiency (strict per-grade, no cross-grade credit)", () => {
  const catalog = [
    { code: "MATH8", name: "Mathematics", gradeLevel: "G8", category: "CORE" },
    { code: "MAPEH8", name: "MAPEH", gradeLevel: "G8", category: "ELECTIVE" },
    { code: "MATH9", name: "Mathematics", gradeLevel: "G9", category: "CORE" },
    { code: "ENG9", name: "English", gradeLevel: "G9", category: "CORE" },
  ];

  it("flags a G8 elective missing for a now-G9 learner", () => {
    const result = buildDeficiencyMap(
      catalog,
      [
        { rawName: "Mathematics", norm: "mathematics", rating: 89, gradeLevel: "G8" },
        { rawName: "Mathematics", norm: "mathematics", rating: 90, gradeLevel: "G9" },
        { rawName: "English", norm: "english", rating: 88, gradeLevel: "G9" },
      ],
      "G9",
    );
    expect(result.deficiencies.map((d) => d.code)).toContain("MAPEH8");
    expect(result.deficiencies.find((d) => d.code === "MAPEH8")).toMatchObject({
      gradeLevel: "G8",
      reason: "not-taken",
    });
  });

  it("treats 0/blank ratings as not taken but keeps failed-with-score as taken", () => {
    const result = buildDeficiencyMap(
      catalog,
      [
        { rawName: "Mathematics", norm: "mathematics", rating: 0, gradeLevel: "G8" },
        { rawName: "MAPEH", norm: "mapeh", rating: null, gradeLevel: "G8" },
        { rawName: "Mathematics", norm: "mathematics", rating: 74, gradeLevel: "G9" },
        { rawName: "English", norm: "english", rating: 88, gradeLevel: "G9" },
      ],
      "G9",
    );
    expect(result.deficiencies.map((d) => d.code)).toContain("MATH8");
    expect(result.deficiencies.map((d) => d.code)).toContain("MAPEH8");
    expect(result.deficiencies.map((d) => d.code)).not.toContain("MATH9");
  });

  it("lists grade subjects in file order with the file's remarks", () => {
    const result = buildDeficiencyMap(
      [
        { code: "SCI7", name: "Science", gradeLevel: "G7", category: "CORE" },
        { code: "MATH7", name: "Mathematics", gradeLevel: "G7", category: "CORE" },
      ],
      [
        { rawName: "Mathematics", norm: "mathematics", rating: 84, gradeLevel: "G7", quarters: [84, 84, 84, 84], remarks: "PASSED" },
        { rawName: "Science", norm: "science", rating: 90, gradeLevel: "G7", quarters: [90, 90, 90, 90], remarks: "PASSED" },
      ],
      "G7",
    );
    const g7 = result.perGrade.find((g) => g.gradeLevel === "G7");
    // Catalog lists Science first, but the file lists Mathematics first.
    expect(g7?.matched.map((m) => m.code)).toEqual(["MATH7", "SCI7"]);
    expect(g7?.matched.map((m) => m.remarks)).toEqual(["PASSED", "PASSED"]);
    expect(g7?.matched.map((m) => m.quarters)).toEqual([
      [84, 84, 84, 84],
      [90, 90, 90, 90],
    ]);
  });

  it("does not credit a G9 elective toward a G8 deficiency", () => {
    const result = buildDeficiencyMap(
      [{ code: "MAPEH8", name: "MAPEH", gradeLevel: "G8", category: "ELECTIVE" }],
      [{ rawName: "MAPEH", norm: "mapeh", rating: 90, gradeLevel: "G9" }],
      "G9",
    );
    expect(result.deficiencies.map((d) => d.code)).toContain("MAPEH8");
  });

  it("ignores untagged rows with no grades (blank template text)", () => {
    const result = buildDeficiencyMap(
      [{ code: "ENG9", name: "English", gradeLevel: "G9", category: "CORE" }],
      [
        { rawName: "English", norm: "english", rating: null, gradeLevel: null, quarters: null, remarks: null },
        { rawName: "Mathematics", norm: "mathematics", rating: null, gradeLevel: null, quarters: [null, null, null, null], remarks: null },
      ],
      "G9",
    );
    // No grade data at all: not add-on subjects, so no empty section.
    expect(result.addons).toEqual([]);
  });

  it("sends untagged rows to add-ons, never into grade tables", () => {
    const result = buildDeficiencyMap(
      [
        { code: "MAPEH8", name: "MAPEH", gradeLevel: "G8", category: "ELECTIVE" },
        { code: "ENG9", name: "English", gradeLevel: "G9", category: "CORE" },
      ],
      [{ rawName: "English", norm: "english", rating: 88, gradeLevel: null, quarters: null, remarks: "PASSED" }],
      "G9",
    );
    // Untagged English does NOT satisfy the G9 catalog requirement…
    expect(result.deficiencies.map((d) => d.code)).toContain("MAPEH8");
    expect(result.deficiencies.map((d) => d.code)).toContain("ENG9");
    // …it lives in the separate add-ons record instead, with its grades.
    expect(result.addons).toMatchObject([
      { norm: "english", rating: 88, remarks: "PASSED" },
    ]);
    const g9 = result.perGrade.find((g) => g.gradeLevel === "G9");
    expect(g9?.matched).toEqual([]);
  });

  it("parses rated year-aware subjects from flat text", () => {
    const subjects = extractRatedSubjectsFromText(
      "Grade 8\nMathematics 89\nMAPEH\nGrade 9\nEnglish 88",
    );
    const math8 = subjects.find((s) => s.norm === "mathematics" && s.gradeLevel === "G8");
    const mapeh8 = subjects.find((s) => s.norm === "mapeh" && s.gradeLevel === "G8");
    const eng9 = subjects.find((s) => s.norm === "english" && s.gradeLevel === "G9");
    expect(math8?.rating).toBe(89);
    expect(mapeh8?.rating).toBe(null);
    expect(eng9?.rating).toBe(88);
  });

  it("reads XLSX grade sections with ratings", async () => {
    const imported = (await import("exceljs")) as unknown as typeof import("exceljs") & {
      default?: typeof import("exceljs");
    };
    const ExcelJS = imported.default ?? imported;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("SF10");
    ws.addRow(["Grade 8"]);
    ws.addRow(["Mathematics", 89]);
    ws.addRow(["MAPEH", ""]);
    ws.addRow(["Grade 9"]);
    ws.addRow(["English", 88]);
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    const subjects = await extractXlsxSubjects(buffer);
    const math8 = subjects.find((s) => s.norm === "mathematics" && s.gradeLevel === "G8");
    const mapeh8 = subjects.find((s) => s.norm === "mapeh" && s.gradeLevel === "G8");
    expect(math8?.rating).toBe(89);
    expect(mapeh8?.rating).toBe(null);
    const result = buildDeficiencyMap(
      [
        { code: "MATH8", name: "Mathematics", gradeLevel: "G8", category: "CORE" },
        { code: "MAPEH8", name: "MAPEH", gradeLevel: "G8", category: "ELECTIVE" },
      ],
      subjects,
      "G8",
    );
    expect(result.deficiencies.map((d) => d.code)).toContain("MAPEH8");
    expect(result.deficiencies.map((d) => d.code)).not.toContain("MATH8");
  });
});

describe("SF10 learner identity (upload-first, no picker)", () => {
  it("extracts LRN preferring 1-led 12-digit numbers", () => {
    expect(extractLrn("LRN: 109876543210")).toBe("109876543210");
    expect(extractLrn("no digits here")).toBe(null);
    expect(extractLrn("SY 2024-2025")).toBe(null);
  });

  it("parses comma-order names with suffix", () => {
    expect(parseFullName("DELA CRUZ, JUAN A. JR")).toMatchObject({
      lastName: "DELA CRUZ",
      firstName: "JUAN",
      middleName: "A",
      suffix: "JR",
    });
  });

  it("parses no-comma names as First … Last", () => {
    expect(parseFullName("Juan A. Dela Cruz")).toMatchObject({
      lastName: "CRUZ",
      firstName: "JUAN",
    });
  });

  it("reads split fields from flat text", () => {
    const id = extractIdentityFromText(
      "Learner's Information\nLast Name: DELA CRUZ\nFirst Name: JUAN\nMiddle Name: REYES\nSuffix: JR\nLRN: 109876543210",
    );
    expect(id).toMatchObject({
      lrn: "109876543210",
      lastName: "DELA CRUZ",
      firstName: "JUAN",
      middleName: "REYES",
      suffix: "JR",
    });
    expect(id.fullName).toBe("DELA CRUZ, JUAN REYES JR");
    expect(formatLearnerName(id)).toBe("DELA CRUZ, JUAN REYES JR");
  });

  it("reads header-row XLSX learner blocks", () => {
    const id = extractIdentityFromCells([
      ["LAST NAME", "FIRST NAME", "MIDDLE NAME", "SUFFIX", "LRN"],
      ["DELA CRUZ", "JUAN", "REYES", "JR", "109876543210"],
      ["LEARNING AREAS", "Final Rating"],
    ]);
    expect(id).toMatchObject({
      lrn: "109876543210",
      lastName: "DELA CRUZ",
      firstName: "JUAN",
      suffix: "JR",
    });
  });

  it("reads real SF10-JHS same-row blocks (labels + values share a row)", () => {
    const id = extractIdentityFromCells([
      ["Republic of the Philippines"],
      ["LEARNER'S INFORMATION"],
      ["LAST NAME:", "", "Jones", "FIRST NAME:", "", "Tammy", "NAME EXT. (Jr,I,II):", "", "MIDDLE NAME:", "", "Mccullough"],
      ["Learner Reference Number (LRN):", "", "101456025233", "Birthdate (mm/dd/yyyy):", "", "05/30/2009", "Sex:", "", "Female"],
      ["ELIGIBILITY FOR JHS ENROLMENT"],
    ]);
    expect(id).toMatchObject({
      lrn: "101456025233",
      lastName: "JONES",
      firstName: "TAMMY",
      middleName: "MCCULLOUGH",
    });
    expect(id.fullName).toBe("JONES, TAMMY MCCULLOUGH");
  });

  it("never accepts another label as a name value", () => {
    const id = extractIdentityFromCells([
      ["LAST NAME", "FIRST NAME"],
      ["Learner Reference Number (LRN):", "101456025233"],
    ]);
    expect(id.lastName).toBe(null);
    expect(id.firstName).toBe(null);
    expect(id.lrn).toBe("101456025233");
  });

  it("cuts same-line trailing labels in flat text", () => {
    const id = extractIdentityFromText(
      "LAST NAME: Jones FIRST NAME: Tammy NAME EXT.: MIDDLE NAME: Mccullough",
    );
    expect(id).toMatchObject({
      lastName: "JONES",
      firstName: "TAMMY",
      middleName: "MCCULLOUGH",
    });
  });

  it("scores roster names order-insensitively with initial tolerance", () => {
    const identity = { lastName: "DELA CRUZ", firstName: "JUAN", middleName: "A", suffix: "JR" };
    expect(scoreNameMatch(identity, "Dela Cruz, Juan A. Jr.")).toBeGreaterThanOrEqual(90);
    expect(scoreNameMatch(identity, "Juan Antonio Dela Cruz")).toBeGreaterThanOrEqual(55);
    expect(scoreNameMatch(identity, "Santos, Maria C.")).toBe(0);
    expect(scoreNameMatch({ lastName: null, firstName: null, middleName: null, suffix: null }, "Juan Dela Cruz")).toBe(0);
  });
});

function qrow(vals: Array<number | null>): Array<number | string | null> {
  const row: Array<number | string | null> = new Array(40).fill(null);
  row[21] = vals[0];
  row[25] = vals[1];
  row[29] = vals[2];
  row[33] = vals[3];
  return row;
}

describe("SF10 sheet formulas (uncached FINAL RATING / REMARKS)", () => {
  const FINAL =
    'IF(OR(U25="",Y25="",AC25="",AG25=""),"",IF(ISERROR(ROUND(AVERAGE(U25,Y25,AC25,AG25),0)),"",ROUND(AVERAGE(U25,Y25,AC25,AG25),0)))';
  const REMARK =
    'IF(OR(U25="",Y25="",AC25="",AG25="",AJ25=""),"",IF(AJ25>=75,"PASSED","FAILED"))';

  it("computes ROUND(AVERAGE(...)) finals from the row's own quarters", () => {
    expect(evaluateFormula(FINAL, 25, qrow([86, 86, 93, 83]))).toBe(87);
    expect(evaluateFormula(FINAL, 25, qrow([92, 77, 81, 87]))).toBe(84);
  });

  it("blanks the final when any quarter is missing", () => {
    expect(evaluateFormula(FINAL, 25, qrow([86, null, 93, 83]))).toBe(null);
  });

  it("derives PASSED/FAILED remarks from the chained final cell", () => {
    const row = qrow([86, 86, 93, 83]);
    row[36] = evaluateFormula(FINAL, 25, row) as number;
    expect(evaluateFormula(REMARK, 25, row)).toBe("PASSED");
    const failing = qrow([70, 70, 70, 70]);
    failing[36] = evaluateFormula(FINAL, 25, failing) as number;
    expect(evaluateFormula(REMARK, 25, failing)).toBe("FAILED");
  });

  it("supports ranges, IFERROR, and plain averages", () => {
    const row: Array<number | string | null> = new Array(40).fill(null);
    row[21] = 80; row[25] = 84; row[29] = 88; row[33] = 92;
    expect(evaluateFormula("ROUND(AVERAGE(U8:AI8),0)", 25, row)).toBe(null);
    const row8: Array<number | string | null> = new Array(40).fill(null);
    row8[21] = 80; row8[25] = 84; row8[29] = 88; row8[33] = 92;
    expect(evaluateFormula("(AG8+AC8+Y8+U8)/4", 8, row8)).toBe(86);
    expect(
      evaluateFormula('IFERROR(IF(OR(U8="",Y8=""),"",ROUND(AVERAGE(U8:AI8),0)),"")', 8, row8),
    ).toBe(86);
  });

  it("refuses cross-row refs and unknown functions (blank, never invented)", () => {
    expect(evaluateFormula("AVERAGE(U25)", 26, qrow([86, 86, 93, 83]))).toBe(null);
    expect(evaluateFormula("VLOOKUP(U25,A1:B2,2)", 25, qrow([86, 86, 93, 83]))).toBe(null);
    expect(evaluateFormula("", 25, qrow([86, 86, 93, 83]))).toBe(null);
  });
});

describe("SF10 unknown learning areas (kept as on record)", () => {
  it("keeps text rows like STVE with their grades, skips metadata", async () => {
    const { extractRatedSubjectsFromText } = await import("../src/services/sf10/subject-aliases.js");
    const subjects = extractRatedSubjectsFromText(
      "Classified as Grade: 10\n" +
        "STVE 83 94 88 82 87 PASSED\n" +
        "School: Mati National Comprehensive High School\n" +
        "School ID: 304326\n" +
        "General Average 86 PROMOTED\n" +
        "LRN: 145516065812\n",
    );
    const stve = subjects.find((s) => s.norm === "stve");
    expect(stve).toMatchObject({
      rawName: "STVE",
      gradeLevel: "G10",
      rating: 87,
      quarters: [83, 94, 88, 82],
      remarks: "PASSED",
    });
    expect(subjects.length).toBe(1);
  });

  it("keeps spreadsheet rows like STVE with their grades, skips metadata", async () => {
    const { extractSubjectsFromGrid } = await import("../src/services/sf10/ocr-text.service.js");
    const subjects = extractSubjectsFromGrid([
      ["Classified as Grade:", "10"],
      ["LEARNING AREAS", "1", "2", "3", "4", "FINAL RATING", "REMARKS"],
      ["STVE", "83", "94", "88", "82", "87", "PASSED"],
      ["School ID:", "304326"],
      ["General Average", "86", "86", "86", "86", "86", "PROMOTED"],
    ]);
    const stve = subjects.find((s) => s.norm === "stve");
    expect(stve).toMatchObject({
      rawName: "STVE",
      gradeLevel: "G10",
      rating: 87,
      remarks: "PASSED",
    });
    expect(subjects.length).toBe(1);
  });
});
