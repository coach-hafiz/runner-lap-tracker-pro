let allStudents = [];
let selectedIds = new Set();
let runners = [];
let lapData = {};
let lapHistory = [];
let startTime = null;
let interval = null;
let totalLaps = 0;
let latestResults = [];
const MAX_STUDENTS = 43;

const $ = (id) => document.getElementById(id);

function init() {
  for (let i = 1; i <= 20; i++) $("lapCount").add(new Option(i, i));
  $("lapCount").value = "6";

  $("classListFile").addEventListener("change", handleFileUpload);
  $("loadSampleBtn").addEventListener("click", loadSampleData);
  $("selectAllBtn").addEventListener("click", selectAllStudents);
  $("clearSelectionBtn").addEventListener("click", clearSelection);
  $("confirmRunnersBtn").addEventListener("click", confirmRunners);
  $("startBtn").addEventListener("click", startTimer);
  $("stopBtn").addEventListener("click", stopTimer);
  $("resetBtn").addEventListener("click", resetRun);
  $("undoBtn").addEventListener("click", undoLap);

  renderStudents();
}

document.addEventListener("DOMContentLoaded", init);

function normaliseKey(key) {
  return String(key || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function pick(row, possibleKeys) {
  const keyMap = {};
  Object.keys(row).forEach((k) => keyMap[normaliseKey(k)] = k);

  for (const key of possibleKeys) {
    const found = keyMap[normaliseKey(key)];
    if (found && row[found] !== undefined && String(row[found]).trim() !== "") {
      return String(row[found]).trim();
    }
  }
  return "";
}

function splitCsvLine(line) {
  return String(line)
    .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
    .map((cell) => cell.replace(/^"|"$/g, "").trim());
}

function csvToMatrix(text) {
  return String(text)
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .map(splitCsvLine);
}

function matrixToRows(matrix) {
  if (!matrix || matrix.length === 0) return [];

  const headerRowIndex = detectHeaderRow(matrix);
  const headers = matrix[headerRowIndex].map((h, i) => String(h || `Column ${i + 1}`).trim() || `Column ${i + 1}`);

  return matrix.slice(headerRowIndex + 1)
    .map((values) => {
      const row = {};
      headers.forEach((h, i) => row[h] = values[i] || "");
      row.__rawValues = values;
      return row;
    })
    .filter((row) => row.__rawValues.some((cell) => String(cell).trim() !== ""));
}

function detectHeaderRow(matrix) {
  const maxRowsToScan = Math.min(matrix.length, 15);
  let bestIndex = 0;
  let bestScore = -1;

  for (let r = 0; r < maxRowsToScan; r++) {
    const rowText = matrix[r].map(normaliseKey).join(" ");
    let score = 0;

    if (/index|indexno|indexnumber|register|regno|admno|admission|sno|serial|no/.test(rowText)) score += 3;
    if (/name|studentname|nameofstudent|pupilname|fullname|student/.test(rowText)) score += 5;
    if (/class|formclass|teacher|staff|gender|sex|age|timing|time/.test(rowText)) score += 1;

    if (score > bestScore) {
      bestScore = score;
      bestIndex = r;
    }
  }

  return bestIndex;
}

async function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const rows = await readClassList(file);
    extractClassMeta(rows, file.name);
    const extractedStudents = rowsToStudents(rows);
    allStudents = extractedStudents.slice(0, MAX_STUDENTS);
    selectedIds = new Set();
    renderStudents();

    if (allStudents.length === 0) {
      $("uploadStatus").textContent = "File loaded, but no student names were detected. Check that the file has a name column or use the sample format.";
    } else {
      const sampleNames = allStudents.slice(0, 3).map((s) => `${s.index}. ${s.name}`).join(" | ");
      const limitNote = extractedStudents.length > MAX_STUDENTS ? ` Only the first ${MAX_STUDENTS} students were loaded.` : "";
      $("uploadStatus").textContent = `Loaded ${allStudents.length} students from ${file.name}.${limitNote} Detected: ${sampleNames}`;
    }
  } catch (error) {
    console.error(error);
    $("uploadStatus").textContent = "Could not read the file. Try CSV/XLSX with columns such as Index, Name, Gender, Age, Class, Teacher.";
  }
}

function readClassList(file) {
  const ext = file.name.split(".").pop().toLowerCase();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;

    if (["xlsx", "xls"].includes(ext)) {
      reader.onload = (e) => {
        const workbook = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const matrix = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "" });
        resolve(matrixToRows(matrix));
      };
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = (e) => resolve(matrixToRows(csvToMatrix(e.target.result)));
      reader.readAsText(file);
    }
  });
}

function extractClassMeta(rows, filename) {
  const firstRow = rows[0] || {};
  const classFromRow = pick(firstRow, ["class", "form class", "class name", "form", "level class"]);
  const staffFromRow = pick(firstRow, ["staff", "teacher", "staff teacher", "staff/teacher", "conducted by", "pe teacher", "form teacher", "ct", "teacher name"]);
  const classFromFilename = (filename.match(/(?:class|cls|form)[-_ ]?([a-z0-9]+)/i) || [])[1];

  if (classFromRow) $("classField").value = classFromRow;
  else if (classFromFilename) $("classField").value = classFromFilename.toUpperCase();

  if (staffFromRow) $("conductedByField").value = staffFromRow;
}

function rowsToStudents(rows) {
  return rows.map((row, i) => {
    const rawValues = row.__rawValues || Object.values(row);

    const index = pick(row, [
      "index", "index no", "index number", "index no.", "register", "register no", "reg no", "reg no.",
      "class no", "class number", "admission no", "adm no", "s/n", "sn", "s no", "no", "number"
    ]) || guessIndexFromRaw(rawValues) || String(i + 1);

    let name = pick(row, [
      "name", "student", "student name", "student's name", "students name", "name of student", "name of pupil",
      "full name", "pupil name", "child name", "student full name", "official name", "name as in nric", "name as per nric"
    ]);

    if (!name) {
      name = guessNameFromRaw(rawValues, index);
    }

    // Last fallback: if the row looks like "1, Muhammad Hafiz, M, 14", use the first text-like cell as the name.
    if (!name) {
      const fallback = rawValues
        .map((value) => String(value || "").replace(/\s+/g, " ").trim())
        .find((text) => text && text !== String(index) && /[A-Za-z]/.test(text) && !/^\d{1,2}:\d{2}$/.test(text));
      name = fallback || `Student ${index}`;
    }

    const gender = pick(row, ["gender", "sex", "m/f", "male/female"]) || guessGenderFromRaw(rawValues);
    const age = pick(row, ["age", "age group", "student age"]);
    const currentTime = pick(row, ["current time", "current 1.6km", "current 2.4km", "run time", "timing", "finish time", "time"]);

    return {
      id: `${index}-${name}-${i}`,
      index,
      name,
      firstName: getFirstName(name),
      gender,
      age,
      currentTime,
      className: pick(row, ["class", "form class", "form"]),
      raw: row
    };
  })
  .filter((student) => {
    const name = String(student.name || "").trim();
    if (!name) return false;
    if (/^(name|student|student name|pupil name)$/i.test(name)) return false;
    return true;
  })
  .slice(0, MAX_STUDENTS);
}

function guessGenderFromRaw(values) {
  for (const value of values) {
    const text = String(value || "").trim().toUpperCase();
    if (["M", "MALE", "BOY"].includes(text)) return "M";
    if (["F", "FEMALE", "GIRL"].includes(text)) return "F";
  }
  return "";
}

function guessIndexFromRaw(values) {
  for (const value of values) {
    const text = String(value || "").trim();
    if (/^\d{1,3}$/.test(text)) return text;
  }
  return "";
}

function guessNameFromRaw(values, index) {
  const badWords = /^(name|student|student name|pupil name|index|index no|class|teacher|staff|gender|sex|age|time|timing|male|female|m|f)$/i;
  const candidates = values
    .map((value) => String(value || "").replace(/\s+/g, " ").trim())
    .filter((text) => text !== "")
    .filter((text) => text !== String(index))
    .filter((text) => !badWords.test(text))
    .filter((text) => /[a-zA-Z]/.test(text))
    .filter((text) => !/^\d{1,2}:\d{2}$/.test(text));

  if (candidates.length === 0) return "";

  candidates.sort((a, b) => {
    const aScore = nameScore(a);
    const bScore = nameScore(b);
    return bScore - aScore;
  });

  return candidates[0];
}

function nameScore(text) {
  let score = 0;
  const words = text.split(" ").filter(Boolean);
  if (words.length >= 2) score += 5;
  if (words.length === 1) score += 2;
  if (/^[A-Za-z .'-]+$/.test(text)) score += 3;
  if (text.length >= 4 && text.length <= 50) score += 2;
  if (/class|teacher|school|total|date/i.test(text)) score -= 5;
  return score;
}

function getFirstName(name) {
  const cleaned = String(name).replace(/\s+/g, " ").trim();
  if (!cleaned) return "Student";
  return cleaned.split(" ")[0];
}

function renderStudents() {
  const grid = $("studentGrid");

  if (allStudents.length === 0) {
    grid.innerHTML = `<p class="muted">Upload a class list to auto-generate student grids. Student names will appear here.</p>`;
    $("selectionStatus").textContent = "";
    return;
  }

  grid.innerHTML = allStudents.map((s) => `
    <button class="student-card ${selectedIds.has(s.id) ? "selected" : ""}" data-id="${escapeHtml(s.id)}" type="button">
      <div class="index">${escapeHtml(s.index)}</div>
      <div class="name">${escapeHtml(s.firstName || s.name || `Student ${s.index}`)}</div>
      <div class="small full-name">${escapeHtml(s.name || `Student ${s.index}`)}</div>
    </button>
  `).join("");

  document.querySelectorAll(".student-card").forEach((card) => {
    card.addEventListener("click", () => toggleStudent(card.dataset.id));
  });

  $("selectionStatus").textContent = `${selectedIds.size} selected out of ${allStudents.length}.`;
}

function toggleStudent(id) {
  if (selectedIds.has(id)) selectedIds.delete(id);
  else selectedIds.add(id);
  renderStudents();
}

function selectAllStudents() {
  selectedIds = new Set(allStudents.map((s) => s.id));
  renderStudents();
}

function clearSelection() {
  selectedIds = new Set();
  renderStudents();
}

function confirmRunners() {
  if (selectedIds.size === 0) {
    $("selectionStatus").textContent = "Select at least one runner first.";
    return;
  }

  totalLaps = parseInt($("lapCount").value, 10);
  runners = allStudents.filter((s) => selectedIds.has(s.id));
  lapData = {};
  lapHistory = [];
  latestResults = [];
  runners.forEach((runner) => lapData[runner.id] = []);

  renderRunnerGrid();
  $("summary").innerHTML = "";
  $("selectionStatus").textContent = `${runners.length} runners confirmed. Press Start when ready.`;
}

function renderRunnerGrid() {
  const grid = $("runnerGrid");

  if (runners.length === 0) {
    grid.innerHTML = `<p class="muted">Confirmed runners will appear here.</p>`;
    return;
  }

  grid.innerHTML = runners.map((runner) => {
    const completed = lapData[runner.id]?.length || 0;
    const remaining = totalLaps - completed;
    const status = remaining > 1 ? `${remaining} laps` : remaining === 1 ? "Last Lap" : "Done";

    return `
      <button class="runner-card ${remaining === 0 ? "done" : `lap-${remaining}`}" data-id="${escapeHtml(runner.id)}" type="button" ${remaining === 0 ? "disabled" : ""}>
        <div class="index">${escapeHtml(runner.index)}</div>
        <div class="name">${escapeHtml(runner.firstName || runner.name || `Student ${runner.index}`)}</div>
        <div class="small full-name">${escapeHtml(runner.name || `Student ${runner.index}`)}</div>
        <div class="laps">${status}</div>
      </button>
    `;
  }).join("");

  document.querySelectorAll(".runner-card").forEach((card) => {
    card.addEventListener("click", () => recordLap(card.dataset.id));
  });
}

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function timeToSeconds(time) {
  if (!time || time === "DNF") return Infinity;
  const parts = String(time).split(":").map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return Number(time) || Infinity;
}

function startTimer() {
  if (runners.length === 0) {
    $("summary").innerHTML = `<p class="muted">Confirm runners before starting.</p>`;
    return;
  }

  if (interval) clearInterval(interval);
  startTime = new Date();

  interval = setInterval(() => {
    $("elapsedTime").textContent = formatTime(new Date() - startTime);
  }, 1000);
}

function recordLap(runnerId) {
  if (!startTime) return;

  const completed = lapData[runnerId]?.length || 0;
  if (completed >= totalLaps) return;

  const elapsed = formatTime(new Date() - startTime);
  lapData[runnerId].push(elapsed);
  lapHistory.push(runnerId);
  renderRunnerGrid();
}

function undoLap() {
  if (lapHistory.length === 0) return;

  const runnerId = lapHistory.pop();
  if (lapData[runnerId]?.length > 0) lapData[runnerId].pop();
  renderRunnerGrid();
}

function resetRun() {
  clearInterval(interval);
  interval = null;
  startTime = null;
  $("elapsedTime").textContent = "00:00";
  lapData = {};
  lapHistory = [];
  runners.forEach((runner) => lapData[runner.id] = []);
  renderRunnerGrid();
  $("summary").innerHTML = "";
}

function stopTimer() {
  clearInterval(interval);
  interval = null;

  latestResults = runners.map((runner) => {
    const laps = lapData[runner.id] || [];
    const finish = laps.length === totalLaps ? laps[laps.length - 1] : "DNF";
    return { ...runner, finish, position: "-", distance: $("runDistance").value };
  }).sort((a, b) => timeToSeconds(a.finish) - timeToSeconds(b.finish));

  let position = 1;
  latestResults = latestResults.map((result) => {
    if (result.finish !== "DNF") return { ...result, position: position++ };
    return result;
  });

  localStorage.setItem("runnerLapTrackerProResults", JSON.stringify({
    className: $("classField").value,
    staff: $("conductedByField").value,
    date: new Date().toLocaleString(),
    distance: $("runDistance").value,
    results: latestResults
  }));

  renderSummary();
}

function renderSummary() {
  if (latestResults.length === 0) return;

  $("summary").innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Position</th><th>Index</th><th>Name</th><th>Finish Time</th><th>Status</th></tr>
        </thead>
        <tbody>
          ${latestResults.map((r) => `
            <tr>
              <td>${escapeHtml(r.position)}</td>
              <td>${escapeHtml(r.index)}</td>
              <td>${escapeHtml(r.name)}</td>
              <td>${escapeHtml(r.finish)}</td>
              <td>${r.finish === "DNF" ? "DNF" : "Finished"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
    <button type="button" onclick="downloadCSV()">Download CSV</button>
    <button type="button" onclick="window.location.href='feedback.html'">View NAPFA Feedback</button>
  `;
}

function downloadCSV() {
  const rows = [
    ["Class", $("classField").value],
    ["Staff / Teacher", $("conductedByField").value],
    ["Date", new Date().toLocaleString()],
    ["Distance", `${$("runDistance").value} km`],
    [],
    ["Position", "Index", "Name", "Gender", "Age", "Finish Time", "Status"]
  ];

  latestResults.forEach((r) => {
    rows.push([r.position, r.index, r.name, r.gender, r.age, r.finish, r.finish === "DNF" ? "DNF" : "Finished"]);
  });

  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `runner-lap-tracker-pro-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function loadSampleData() {
  const rows = [
    { Index: 1, Name: "Adam Tan", Gender: "M", Age: 14, Class: "2A", Teacher: "Mr Hafiz", "Current Time": "13:25" },
    { Index: 2, Name: "Bryan Lee", Gender: "M", Age: 14, Class: "2A", Teacher: "Mr Hafiz", "Current Time": "12:55" },
    { Index: 3, Name: "Chloe Lim", Gender: "F", Age: 14, Class: "2A", Teacher: "Mr Hafiz", "Current Time": "16:35" },
    { Index: 4, Name: "Danish Rahman", Gender: "M", Age: 14, Class: "2A", Teacher: "Mr Hafiz", "Current Time": "14:45" },
    { Index: 5, Name: "Emily Wong", Gender: "F", Age: 14, Class: "2A", Teacher: "Mr Hafiz", "Current Time": "15:45" }
  ];

  extractClassMeta(rows, "Class-2A.csv");
  allStudents = rowsToStudents(rows);
  selectedIds = new Set();
  renderStudents();
  $("uploadStatus").textContent = "Sample class list loaded.";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[char]));
}
