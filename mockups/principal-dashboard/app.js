// Sample data — mirrors the spec in docs/role-modules/principal.md
// Heat map = section (rows) × risk factor (cols) = student COUNTS (no names).

const sections = [
  "Grade 7-A", "Grade 7-B", "Grade 8-A", "Grade 8-B",
  "Grade 9-A", "Grade 9-B", "Grade 10-A", "Grade 10-B",
  "Grade 11-A", "Grade 11-B", "Grade 12-A", "Grade 12-B",
];

// [academic, attendance, behavioral] counts per section
const heat = [
  [4, 3, 2], [2, 5, 1], [6, 4, 3], [3, 2, 2],
  [9, 14, 5], [12, 11, 6], [5, 6, 2], [4, 3, 3],
  [3, 4, 1], [2, 2, 2], [1, 3, 0], [4, 2, 1],
];

function shade(n) {
  if (n === 0) return "hm hm-0";
  if (n <= 2) return "hm hm-1";
  if (n <= 4) return "hm hm-2";
  if (n <= 6) return "hm hm-3";
  if (n <= 9) return "hm hm-4";
  return "hm hm-5";
}

const tbody = document.getElementById("heat-body");
sections.forEach((sec, i) => {
  const tr = document.createElement("tr");
  tr.className = "hover:bg-ink-50";
  tr.innerHTML = `
    <td class="py-1.5 pr-3 font-medium text-ink-700">${sec}</td>
    ${heat[i].map((n, c) => `
      <td class="px-2">
        <div class="${shade(n)} hm-cell" title="${sec} · ${["Academic","Attendance","Behavioral"][c]}: ${n} students">${n}</div>
      </td>`).join("")}
  `;
  tbody.appendChild(tr);
});

// Recent notifications — types from PLAN.md §3.8 / backend.md §7.5
const notifs = [
  { dot: "bg-amber-500", title: "ADM case ready for signature", sub: "Delos Reyes, Maria · Grade 9-B", time: "12m" },
  { dot: "bg-brand-500", title: "Account approval routed", sub: "5 pending · RK / Registrar", time: "1h" },
  { dot: "bg-ink-400", title: "Intervention approved", sub: "Guidance · Grade 8-A", time: "3h" },
  { dot: "bg-ink-400", title: "SF10 validated", sub: "Registrar · Grade 11-A", time: "Yesterday" },
  { dot: "bg-ink-400", title: "Audit alert", sub: "grade_lock · final_grades", time: "Yesterday" },
];

const list = document.getElementById("notif-list");
notifs.forEach((n) => {
  const li = document.createElement("li");
  li.className = "notif-row";
  li.innerHTML = `
    <span class="notif-dot ${n.dot}"></span>
    <div class="min-w-0">
      <p class="text-sm text-ink-800 leading-tight">${n.title}</p>
      <p class="text-[11px] text-ink-400 truncate">${n.sub}</p>
    </div>
    <span class="ml-auto text-[10px] text-ink-400 whitespace-nowrap">${n.time}</span>
  `;
  list.appendChild(li);
});
