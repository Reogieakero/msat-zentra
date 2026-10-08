export const gradeNum = (name: string) => {
  const m = String(name).match(/(\d+)/);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  return Number.isNaN(n) ? 0 : n;
};
export function groupSectionsByGrade(sections: string[]): [number, string[]][] {
  const map = new Map<number, string[]>();
  for (const s of sections) {
    const g = gradeNum(s);
    if (!map.has(g)) map.set(g, []);
    map.get(g)!.push(s);
  }
  return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
}
export function sortSectionNames(names: string[]): string[] {
  return [...names].sort((a, b) => gradeNum(a) - gradeNum(b) || a.localeCompare(b));
}
