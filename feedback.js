let feedbackRows = [];

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", () => {
  $("feedbackFile").addEventListener("change", handleFeedbackUpload);
  $("recalculateBtn").addEventListener("click", renderFeedback);
  loadLatestRun();
});

const NAPFA_RUN = {
  M: {
    "1.6": {
      9:  { A: 580, B: 640, C: 700, D: 760, E: 830 },
      10: { A: 570, B: 630, C: 700, D: 760, E: 820 },
      11: { A: 530, B: 600, C: 670, D: 740, E: 810 },
      12: { A: 520, B: 580, C: 640, D: 700, E: 750 },
      13: { A: 490, B: 550, C: 610, D: 660, E: 720 }
    },
    "2.4": {
      14: { A: 661, B: 720, C: 780, D: 850, E: 920 },
      15: { A: 641, B: 700, C: 760, D: 820, E: 880 },
      16: { A: 631, B: 690, C: 740, D: 800, E: 850 },
      17: { A: 621, B: 670, C: 720, D: 770, E: 820 },
      18: { A: 621, B: 670, C: 710, D: 760, E: 810 },
      19: { A: 621, B: 660, C: 700, D: 750, E: 800 },
      20: { A: 621, B: 660, C: 700, D: 740, E: 780 }
    }
  },
  F: {
    "1.6": {
      9:  { A: 640, B: 700, C: 770, D: 830, E: 900 },
      10: { A: 630, B: 685, C: 750, D: 805, E: 870 },
      11: { A: 620, B: 670, C: 730, D: 780, E: 840 },
      12: { A: 610, B: 660, C: 720, D: 770, E: 830 },
      13: { A: 600, B: 650, C: 710, D: 760, E: 820 }
    },
    "2.4": {
      14: { A: 861, B: 920, C: 980, D: 1040, E: 1100 },
      15: { A: 851, B: 910, C: 970, D: 1030, E: 1090 },
      16: { A: 841, B: 900, C: 960, D: 1020, E: 1070 },
      17: { A: 841, B: 890, C: 950, D: 1000, E: 1050 },
      18: { A: 841, B: 890, C: 940, D: 990, E: 1040 },
      19: { A: 861, B: 890, C: 930, D: 980, E: 1030 },
      20: { A: 901, B: 930, C: 960, D: 990, E: 1020 }
    }
  }
};

function loadLatestRun() {
  const stored = localStorage.getItem("runnerLapTrackerProResults");
  if (!stored) {
    $("feedbackStatus").textContent = "No latest Pro run found yet. Upload a result file or complete a Pro run first.";
    return;
  }
  const data = JSON.parse(stored);
  feedbackRows = (data.results || []).map((r) => ({
    index: r.index,
    name: r.name,
    gender: r.gender,
    age: r.age,
    time: r.finish,
    distance: r.distance || data.distance
  }));
  $("feedbackStatus").textContent = `Loaded ${feedbackRows.length} students from latest Pro run.`;
  renderFeedback();
}

async function handleFeedbackUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const rows = await readRows(file);
  feedbackRows = rows.map((row, i) => ({
    index: pick(row, ["index", "index no", "index number", "register", "no"]) || String(i + 1),
    name: pick(row, ["name", "student name", "full name"]) || `Student ${i + 1}`,
    gender: pick(row, ["gender", "sex"]),
    age: pick(row, ["age", "age group"]),
    time: pick(row, ["finish time", "current time", "current 1.6km", "current 2.4km", "run time", "timing"]),
    distance: pick(row, ["distance", "test distance"])
  }));
  $("feedbackStatus").textContent = `Loaded ${feedbackRows.length} students from ${file.name}.`;
  renderFeedback();
}

function readRows(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    if (["xlsx", "xls"].includes(ext)) {
      reader.onload = (e) => {
        const workbook = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        resolve(XLSX.utils.sheet_to_json(sheet, { defval: "" }));
      };
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = (e) => resolve(csvToRows(e.target.result));
      reader.readAsText(file);
    }
  });
}

function csvToRows(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];
  const splitLine = (line) => line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((cell) => cell.replace(/^"|"$/g, "").trim());
  const headers = splitLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = splitLine(line);
    const row = {};
    headers.forEach((h, i) => row[h] = values[i] || "");
    return row;
  });
}

function normaliseKey(key) {
  return String(key || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function pick(row, keys) {
  const map = {};
  Object.keys(row).forEach((k) => map[normaliseKey(k)] = k);
  for (const key of keys) {
    const found = map[normaliseKey(key)];
    if (found && row[found] !== undefined && row[found] !== "") return String(row[found]).trim();
  }
  return "";
}

function renderFeedback() {
  if (feedbackRows.length === 0) {
    $("feedbackSummary").innerHTML = `<p class="muted">No data loaded.</p>`;
    return;
  }
  const analysed = feedbackRows.map(analyseStudent);
  $("feedbackSummary").innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Index</th><th>Name</th><th>Gender</th><th>Age</th><th>Distance</th><th>Time</th><th>Current Grade</th><th>Next Grade Target</th><th>Time to Reduce</th></tr>
        </thead>
        <tbody>
          ${analysed.map((r) => `
            <tr>
              <td>${escapeHtml(r.index)}</td>
              <td>${escapeHtml(r.name)}</td>
              <td>${escapeHtml(r.gender)}</td>
              <td>${escapeHtml(r.age)}</td>
              <td>${escapeHtml(r.distance)} km</td>
              <td>${escapeHtml(r.time)}</td>
              <td>${escapeHtml(r.grade)}</td>
              <td>${escapeHtml(r.nextTarget)}</td>
              <td>${escapeHtml(r.reduceBy)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
    <button type="button" onclick="downloadFeedbackCSV()">Download Feedback CSV</button>
  `;
  window.latestFeedback = analysed;
}

function analyseStudent(row) {
  const gender = normaliseGender(row.gender || $("fallbackGender").value);
  const age = Number(row.age || $("fallbackAge").value);
  const forcedDistance = $("distanceSelect").value;
  const distance = forcedDistance === "auto" ? (age < 14 ? "1.6" : "2.4") : forcedDistance;
  const seconds = timeToSeconds(row.time);
  const standards = NAPFA_RUN[gender]?.[distance]?.[age];
  if (!standards || !Number.isFinite(seconds)) {
    return { ...row, gender, age, distance, grade: "Check data", nextTarget: "Need age/gender/time", reduceBy: "-" };
  }
  const grade = getGrade(seconds, standards);
  const next = getNextTarget(seconds, standards);
  return { ...row, gender, age, distance, grade, nextTarget: next.target, reduceBy: next.reduceBy };
}

function normaliseGender(value) {
  const text = String(value || "").trim().toLowerCase();
  if (["m", "male", "boy", "boys"].includes(text)) return "M";
  if (["f", "female", "girl", "girls"].includes(text)) return "F";
  return text.toUpperCase();
}

function getGrade(seconds, standards) {
  if (seconds < standards.A) return "A";
  if (seconds <= standards.B) return "B";
  if (seconds <= standards.C) return "C";
  if (seconds <= standards.D) return "D";
  if (seconds <= standards.E) return "E";
  return "Needs Improvement";
}

function getNextTarget(seconds, standards) {
  const targets = [
    ["A", standards.A - 1],
    ["B", standards.B],
    ["C", standards.C],
    ["D", standards.D],
    ["E", standards.E]
  ];
  for (const [grade, targetSeconds] of targets) {
    if (seconds > targetSeconds) {
      return { target: `${grade} by ${secondsToTime(targetSeconds)}`, reduceBy: secondsToTime(seconds - targetSeconds) };
    }
  }
  return { target: "Already A", reduceBy: "0:00" };
}

function timeToSeconds(time) {
  if (!time || String(time).toUpperCase() === "DNF") return Infinity;
  const parts = String(time).trim().split(":").map(Number);
  if (parts.length === 2 && parts.every(Number.isFinite)) return parts[0] * 60 + parts[1];
  if (parts.length === 3 && parts.every(Number.isFinite)) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  const numeric = Number(time);
  return Number.isFinite(numeric) ? numeric : Infinity;
}

function secondsToTime(total) {
  const seconds = Math.max(0, Math.round(total));
  const m = Math.floor(seconds / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function downloadFeedbackCSV() {
  const rows = [["Index", "Name", "Gender", "Age", "Distance", "Time", "Current Grade", "Next Grade Target", "Time to Reduce"]];
  (window.latestFeedback || []).forEach((r) => rows.push([r.index, r.name, r.gender, r.age, r.distance, r.time, r.grade, r.nextTarget, r.reduceBy]));
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `napfa-feedback-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[char]));
}
