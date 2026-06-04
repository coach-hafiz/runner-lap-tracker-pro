/****************************************************
 * Runner Lap Tracker Pro - NAPFA Feedback
 * Calculates:
 * Current time -> current grade -> next grade target
 * and duration to reduce.
 ****************************************************/

let feedbackRows = [];

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", () => {
  $("feedbackFile").addEventListener("change", handleFeedbackUpload);
  $("recalculateBtn").addEventListener("click", renderFeedback);
  $("distanceSelect").addEventListener("change", renderFeedback);
  $("fallbackAge").addEventListener("input", renderFeedback);
  $("fallbackGender").addEventListener("change", renderFeedback);

  loadLatestRun();
});

/*
  Timing logic:
  A = faster than listed A timing.
  Example: A <14:21 means 14:20 or faster.
  B/C/D/E = up to the listed upper timing.
*/

const NAPFA_RUN = {
  M: {
    "1.6": {
      9:  { A: "09:40", B: "10:40", C: "11:40", D: "12:40", E: "13:50" },
      10: { A: "09:30", B: "10:30", C: "11:40", D: "12:40", E: "13:40" },
      11: { A: "08:50", B: "10:00", C: "11:10", D: "12:20", E: "13:30" },
      12: { A: "08:40", B: "09:40", C: "10:40", D: "11:40", E: "12:30" },
      13: { A: "08:10", B: "09:10", C: "10:10", D: "11:00", E: "12:00" }
    },
    "2.4": {
      12: { A: "12:01", B: "13:10", C: "14:20", D: "15:30", E: "16:50" },
      13: { A: "11:31", B: "12:30", C: "13:40", D: "14:50", E: "16:00" },
      14: { A: "11:01", B: "12:00", C: "13:00", D: "14:10", E: "15:20" },
      15: { A: "10:41", B: "11:40", C: "12:40", D: "13:40", E: "14:40" },
      16: { A: "10:31", B: "11:30", C: "12:20", D: "13:20", E: "14:10" },
      17: { A: "10:21", B: "11:10", C: "12:00", D: "12:50", E: "13:40" },
      18: { A: "10:21", B: "11:10", C: "11:50", D: "12:40", E: "13:30" },
      19: { A: "10:21", B: "11:00", C: "11:40", D: "12:30", E: "13:20" }
    }
  },

  F: {
    "1.6": {
      9:  { A: "10:40", B: "11:40", C: "12:50", D: "13:50", E: "15:00" },
      10: { A: "10:30", B: "11:25", C: "12:30", D: "13:25", E: "14:30" },
      11: { A: "10:20", B: "11:10", C: "12:10", D: "13:00", E: "14:00" },
      12: { A: "10:10", B: "11:00", C: "12:00", D: "12:50", E: "13:50" },
      13: { A: "10:00", B: "10:50", C: "11:50", D: "12:40", E: "13:40" }
    },
    "2.4": {
      12: { A: "14:41", B: "15:40", C: "16:40", D: "17:40", E: "18:40" },
      13: { A: "14:31", B: "15:30", C: "16:30", D: "17:30", E: "18:30" },
      14: { A: "14:21", B: "15:20", C: "16:20", D: "17:20", E: "18:20" },
      15: { A: "14:11", B: "15:10", C: "16:10", D: "17:10", E: "18:10" },
      16: { A: "14:01", B: "15:00", C: "16:00", D: "17:00", E: "17:50" },
      17: { A: "14:01", B: "14:50", C: "15:50", D: "16:40", E: "17:30" },
      18: { A: "14:01", B: "14:50", C: "15:40", D: "16:30", E: "17:20" },
      19: { A: "14:21", B: "14:50", C: "15:30", D: "16:20", E: "17:10" }
    }
  }
};

function loadLatestRun() {
  const stored = localStorage.getItem("runnerLapTrackerProResults");

  if (!stored) {
    $("feedbackStatus").textContent =
      "No latest Pro run found yet. Upload a result file or complete a Pro run first.";
    renderFeedback();
    return;
  }

  try {
    const data = JSON.parse(stored);

    feedbackRows = (data.results || []).map((r) => ({
      index: r.index || r.indexNumber || r.runner || "",
      name: r.name || r.fullName || r.studentName || "",
      gender: r.gender || r.sex || "",
      age: r.age || r.ageGroup || "",
      time: r.finish || r.finishTime || r.time || "DNF",
      distance: r.distance || data.distance || ""
    }));

    $("feedbackStatus").textContent =
      `Loaded ${feedbackRows.length} students from latest Pro run.`;

    renderFeedback();
  } catch (error) {
    console.error(error);
    $("feedbackStatus").textContent =
      "Could not read latest Pro run. Try uploading a CSV/XLSX result file.";
  }
}

async function handleFeedbackUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const rows = await readRows(file);

  feedbackRows = rows.map((row, i) => ({
    index: pick(row, ["index", "index no", "index number", "register", "register no", "no"]) || String(i + 1),
    name: pick(row, ["name", "student name", "full name"]) || `Student ${i + 1}`,
    gender: pick(row, ["gender", "sex"]),
    age: pick(row, ["age", "age group"]),
    time: pick(row, [
      "finish time",
      "current time",
      "current 1.6km",
      "current 1.6 km",
      "current 2.4km",
      "current 2.4 km",
      "run time",
      "timing",
      "time"
    ]),
    distance: pick(row, ["distance", "test distance", "run distance"])
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

  const splitLine = (line) =>
    line
      .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
      .map((cell) => cell.replace(/^"|"$/g, "").trim());

  const headers = splitLine(lines[0]);

  return lines.slice(1).map((line) => {
    const values = splitLine(line);
    const row = {};
    headers.forEach((h, i) => {
      row[h] = values[i] || "";
    });
    return row;
  });
}

function normaliseKey(key) {
  return String(key || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function pick(row, keys) {
  const map = {};

  Object.keys(row).forEach((k) => {
    map[normaliseKey(k)] = k;
  });

  for (const key of keys) {
    const found = map[normaliseKey(key)];
    if (found && row[found] !== undefined && row[found] !== "") {
      return String(row[found]).trim();
    }
  }

  return "";
}

function renderFeedback() {
  if (!feedbackRows || feedbackRows.length === 0) {
    $("feedbackSummary").innerHTML = `<p class="muted">No data loaded.</p>`;
    return;
  }

  const analysed = feedbackRows.map(analyseStudent);

  $("feedbackSummary").innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Index</th>
            <th>Name</th>
            <th>Gender</th>
            <th>Age</th>
            <th>Distance</th>
            <th>Time</th>
            <th>Current Grade</th>
            <th>Next Grade</th>
            <th>Target Time</th>
            <th>Time to Reduce</th>
          </tr>
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
              <td>${escapeHtml(r.nextGrade)}</td>
              <td>${escapeHtml(r.targetTime)}</td>
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

  let distance = forcedDistance === "auto" ? inferDistance(age) : forcedDistance;

  if (row.distance) {
    const rowDistance = normaliseDistance(row.distance);
    if (forcedDistance === "auto" && rowDistance) {
      distance = rowDistance;
    }
  }

  const seconds = timeToSeconds(row.time);
  const standards = NAPFA_RUN[gender]?.[distance]?.[age];

  if (!gender || !age || !distance) {
    return {
      ...row,
      gender: gender || "-",
      age: row.age || "-",
      distance: distance || "-",
      grade: "Check data",
      nextGrade: "-",
      targetTime: "Need gender/age/distance",
      reduceBy: "-"
    };
  }

  if (!standards) {
    return {
      ...row,
      gender,
      age,
      distance,
      grade: "No standard",
      nextGrade: "-",
      targetTime: "No matching age/gender standard",
      reduceBy: "-"
    };
  }

  if (!Number.isFinite(seconds)) {
    return {
      ...row,
      gender,
      age,
      distance,
      grade: "DNF",
      nextGrade: "E",
      targetTime: standards.E,
      reduceBy: "Complete run first"
    };
  }

  const result = getGradeAndNextTarget(seconds, standards);

  return {
    ...row,
    gender,
    age,
    distance,
    grade: result.grade,
    nextGrade: result.nextGrade,
    targetTime: result.targetTime,
    reduceBy: result.reduceBy
  };
}

function inferDistance(age) {
  if (!age) return "";
  return Number(age) < 14 ? "1.6" : "2.4";
}

function normaliseDistance(value) {
  const text = String(value || "").toLowerCase();

  if (text.includes("1.6")) return "1.6";
  if (text.includes("2.4")) return "2.4";

  return "";
}

function normaliseGender(value) {
  const text = String(value || "").trim().toLowerCase();

  if (["m", "male", "boy", "boys"].includes(text)) return "M";
  if (["f", "female", "girl", "girls"].includes(text)) return "F";

  return "";
}

function getGradeAndNextTarget(seconds, standards) {
  const A = timeToSeconds(standards.A);
  const B = timeToSeconds(standards.B);
  const C = timeToSeconds(standards.C);
  const D = timeToSeconds(standards.D);
  const E = timeToSeconds(standards.E);

  let grade;
  let nextGrade;
  let targetSeconds;

  if (seconds < A) {
    grade = "A";
    nextGrade = "Highest grade";
    targetSeconds = seconds;
  } else if (seconds <= B) {
    grade = "B";
    nextGrade = "A";
    targetSeconds = A - 1;
  } else if (seconds <= C) {
    grade = "C";
    nextGrade = "B";
    targetSeconds = B;
  } else if (seconds <= D) {
    grade = "D";
    nextGrade = "C";
    targetSeconds = C;
  } else if (seconds <= E) {
    grade = "E";
    nextGrade = "D";
    targetSeconds = D;
  } else {
    grade = "Fail";
    nextGrade = "E";
    targetSeconds = E;
  }

  if (grade === "A") {
    return {
      grade,
      nextGrade,
      targetTime: "Already A",
      reduceBy: "0:00"
    };
  }

  return {
    grade,
    nextGrade,
    targetTime: secondsToTime(targetSeconds),
    reduceBy: secondsToTime(seconds - targetSeconds)
  };
}

function timeToSeconds(time) {
  if (!time) return Infinity;

  const text = String(time).trim();

  if (text.toUpperCase() === "DNF") return Infinity;

  const parts = text.split(":").map(Number);

  if (parts.length === 2 && parts.every(Number.isFinite)) {
    return parts[0] * 60 + parts[1];
  }

  if (parts.length === 3 && parts.every(Number.isFinite)) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  const numeric = Number(text);
  return Number.isFinite(numeric) ? numeric : Infinity;
}

function secondsToTime(total) {
  if (!Number.isFinite(total)) return "-";

  const seconds = Math.max(0, Math.round(total));
  const m = Math.floor(seconds / 60);
  const s = String(seconds % 60).padStart(2, "0");

  return `${m}:${s}`;
}

function downloadFeedbackCSV() {
  const rows = [[
    "Index",
    "Name",
    "Gender",
    "Age",
    "Distance",
    "Time",
    "Current Grade",
    "Next Grade",
    "Target Time",
    "Time to Reduce"
  ]];

  (window.latestFeedback || []).forEach((r) => {
    rows.push([
      r.index,
      r.name,
      r.gender,
      r.age,
      r.distance,
      r.time,
      r.grade,
      r.nextGrade,
      r.targetTime,
      r.reduceBy
    ]);
  });

  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `napfa-feedback-${new Date().toISOString().slice(0, 10)}.csv`;

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
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  }[char]));
}