/******************************************************
 * Runner Lap Tracker Pro - NAPFA Feedback
 * Calculates current performance grade and time needed
 * to reduce for next grade based on 1.6km / 2.4km
 * Run-Walk time.
 ******************************************************/

const NAPFA_RUN_STANDARDS = {
  primary: {
    male: {
      9:  { distance: "1.6 km", A: "09:40", B: "10:40", C: "11:40", D: "12:40", E: "13:50" },
      10: { distance: "1.6 km", A: "09:30", B: "10:30", C: "11:40", D: "12:40", E: "13:40" },
      11: { distance: "1.6 km", A: "08:50", B: "10:00", C: "11:10", D: "12:20", E: "13:30" },
      12: { distance: "1.6 km", A: "08:40", B: "09:40", C: "10:40", D: "11:40", E: "12:30" },
      13: { distance: "1.6 km", A: "08:10", B: "09:10", C: "10:10", D: "11:00", E: "12:00" },
      14: { distance: "2.4 km", A: "11:01", B: "12:00", C: "13:00", D: "14:10", E: "15:20" },
      15: { distance: "2.4 km", A: "10:41", B: "11:40", C: "12:40", D: "13:40", E: "14:40" }
    },

    female: {
      9:  { distance: "1.6 km", A: "10:40", B: "11:40", C: "12:50", D: "13:50", E: "15:00" },
      10: { distance: "1.6 km", A: "10:30", B: "11:25", C: "12:30", D: "13:25", E: "14:30" },
      11: { distance: "1.6 km", A: "10:20", B: "11:10", C: "12:10", D: "13:00", E: "14:00" },
      12: { distance: "1.6 km", A: "10:10", B: "11:00", C: "12:00", D: "12:50", E: "13:50" },
      13: { distance: "1.6 km", A: "10:00", B: "10:50", C: "11:50", D: "12:40", E: "13:40" },
      14: { distance: "2.4 km", A: "14:21", B: "15:20", C: "16:20", D: "17:20", E: "18:20" },
      15: { distance: "2.4 km", A: "14:11", B: "15:10", C: "16:10", D: "17:10", E: "18:10" },
      16: { distance: "2.4 km", A: "14:01", B: "15:00", C: "16:00", D: "17:00", E: "17:50" }
    }
  },

  secondary: {
    male: {
      12: { distance: "2.4 km", A: "12:01", B: "13:10", C: "14:20", D: "15:30", E: "16:50" },
      13: { distance: "2.4 km", A: "11:31", B: "12:30", C: "13:40", D: "14:50", E: "16:00" },
      14: { distance: "2.4 km", A: "11:01", B: "12:00", C: "13:00", D: "14:10", E: "15:20" },
      15: { distance: "2.4 km", A: "10:41", B: "11:40", C: "12:40", D: "13:40", E: "14:40" },
      16: { distance: "2.4 km", A: "10:31", B: "11:30", C: "12:20", D: "13:20", E: "14:10" },
      17: { distance: "2.4 km", A: "10:21", B: "11:10", C: "12:00", D: "12:50", E: "13:40" },
      18: { distance: "2.4 km", A: "10:21", B: "11:10", C: "11:50", D: "12:40", E: "13:30" },
      19: { distance: "2.4 km", A: "10:21", B: "11:00", C: "11:40", D: "12:30", E: "13:20" }
    },

    female: {
      12: { distance: "2.4 km", A: "14:41", B: "15:40", C: "16:40", D: "17:40", E: "18:40" },
      13: { distance: "2.4 km", A: "14:31", B: "15:30", C: "16:30", D: "17:30", E: "18:30" },
      14: { distance: "2.4 km", A: "14:21", B: "15:20", C: "16:20", D: "17:20", E: "18:20" },
      15: { distance: "2.4 km", A: "14:11", B: "15:10", C: "16:10", D: "17:10", E: "18:10" },
      16: { distance: "2.4 km", A: "14:01", B: "15:00", C: "16:00", D: "17:00", E: "17:50" },
      17: { distance: "2.4 km", A: "14:01", B: "14:50", C: "15:50", D: "16:40", E: "17:30" },
      18: { distance: "2.4 km", A: "14:01", B: "14:50", C: "15:40", D: "16:30", E: "17:20" },
      19: { distance: "2.4 km", A: "14:21", B: "14:50", C: "15:30", D: "16:20", E: "17:10" }
    }
  }
};

function timeToSeconds(timeString) {
  if (!timeString || timeString === "DNF") return null;

  const cleaned = String(timeString).trim();

  const parts = cleaned.split(":").map(Number);

  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return minutes * 60 + seconds;
  }

  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return hours * 3600 + minutes * 60 + seconds;
  }

  return null;
}

function secondsToTime(totalSeconds) {
  if (totalSeconds === null || isNaN(totalSeconds)) return "-";

  totalSeconds = Math.max(0, Math.round(totalSeconds));

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function normaliseGender(gender) {
  const value = String(gender || "").trim().toLowerCase();

  if (["m", "male", "boy", "boys"].includes(value)) return "male";
  if (["f", "female", "girl", "girls"].includes(value)) return "female";

  return "";
}

function getStandard(schoolLevel, gender, age) {
  const level = String(schoolLevel || "").trim().toLowerCase();
  const normalisedGender = normaliseGender(gender);
  const numericAge = Number(age);

  if (
    !NAPFA_RUN_STANDARDS[level] ||
    !NAPFA_RUN_STANDARDS[level][normalisedGender] ||
    !NAPFA_RUN_STANDARDS[level][normalisedGender][numericAge]
  ) {
    return null;
  }

  return NAPFA_RUN_STANDARDS[level][normalisedGender][numericAge];
}

function calculateNapfaRunFeedback({ schoolLevel, gender, age, finishTime }) {
  const standard = getStandard(schoolLevel, gender, age);
  const finishSeconds = timeToSeconds(finishTime);

  if (!standard) {
    return {
      distance: "-",
      currentGrade: "No standard",
      nextGrade: "-",
      targetTime: "-",
      timeToReduce: "-",
      message: "No matching NAPFA standard found for this level, gender and age."
    };
  }

  if (finishSeconds === null) {
    return {
      distance: standard.distance,
      currentGrade: "DNF",
      nextGrade: "E",
      targetTime: standard.E,
      timeToReduce: "-",
      message: `Student needs to complete the ${standard.distance} run-walk to receive a grade.`
    };
  }

  const aCutoff = timeToSeconds(standard.A);
  const bMax = timeToSeconds(standard.B);
  const cMax = timeToSeconds(standard.C);
  const dMax = timeToSeconds(standard.D);
  const eMax = timeToSeconds(standard.E);

  let currentGrade;
  let nextGrade;
  let targetSeconds;

  // A is strictly faster than the A timing shown in the standards.
  // Example: A < 14:21 means 14:20 or faster.
  if (finishSeconds < aCutoff) {
    currentGrade = "A";
    nextGrade = "-";
    targetSeconds = null;
  } else if (finishSeconds <= bMax) {
    currentGrade = "B";
    nextGrade = "A";
    targetSeconds = aCutoff - 1;
  } else if (finishSeconds <= cMax) {
    currentGrade = "C";
    nextGrade = "B";
    targetSeconds = bMax;
  } else if (finishSeconds <= dMax) {
    currentGrade = "D";
    nextGrade = "C";
    targetSeconds = cMax;
  } else if (finishSeconds <= eMax) {
    currentGrade = "E";
    nextGrade = "D";
    targetSeconds = dMax;
  } else {
    currentGrade = "Fail";
    nextGrade = "E";
    targetSeconds = eMax;
  }

  if (currentGrade === "A") {
    return {
      distance: standard.distance,
      currentGrade,
      nextGrade: "Highest grade",
      targetTime: "Already A",
      timeToReduce: "0:00",
      message: "Student has already achieved Grade A."
    };
  }

  const reductionNeeded = finishSeconds - targetSeconds;

  return {
    distance: standard.distance,
    currentGrade,
    nextGrade,
    targetTime: secondsToTime(targetSeconds),
    timeToReduce: secondsToTime(reductionNeeded),
    message: `Reduce by ${secondsToTime(reductionNeeded)} to achieve Grade ${nextGrade}.`
  };
}

/******************************************************
 * Page rendering
 ******************************************************/

function loadLatestRunResults() {
  const possibleKeys = [
    "runnerLapTrackerProResults",
    "latestRunResults",
    "lapTrackerResults",
    "napfaResults"
  ];

  for (const key of possibleKeys) {
    const raw = localStorage.getItem(key);

    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw);

      if (Array.isArray(parsed)) return parsed;

      if (Array.isArray(parsed.results)) return parsed.results;

      if (Array.isArray(parsed.runners)) return parsed.runners;
    } catch (error) {
      console.warn(`Could not parse localStorage key: ${key}`, error);
    }
  }

  return [];
}

function renderFeedbackTable(results) {
  const tableBody = document.getElementById("feedbackBody");

  if (!tableBody) {
    console.error("Missing table body with id='feedbackBody'");
    return;
  }

  tableBody.innerHTML = "";

  if (!results || results.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="10">No run results found. Complete a run first, then return to this page.</td>
      </tr>
    `;
    return;
  }

  const schoolLevelInput = document.getElementById("schoolLevel");
  const selectedSchoolLevel = schoolLevelInput ? schoolLevelInput.value : "secondary";

  results.forEach((student) => {
    const indexNumber =
      student.indexNumber ||
      student.index ||
      student.runner ||
      student.id ||
      "-";

    const name =
      student.name ||
      student.fullName ||
      student.studentName ||
      `Runner ${indexNumber}`;

    const gender =
      student.gender ||
      student.sex ||
      "";

    const age =
      student.age ||
      student.ageGroup ||
      "";

    const finishTime =
      student.finish ||
      student.finishTime ||
      student.time ||
      "DNF";

    const feedback = calculateNapfaRunFeedback({
      schoolLevel: selectedSchoolLevel,
      gender,
      age,
      finishTime
    });

    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${indexNumber}</td>
      <td>${name}</td>
      <td>${gender || "-"}</td>
      <td>${age || "-"}</td>
      <td>${feedback.distance}</td>
      <td>${finishTime}</td>
      <td>${feedback.currentGrade}</td>
      <td>${feedback.nextGrade}</td>
      <td>${feedback.targetTime}</td>
      <td>${feedback.timeToReduce}</td>
    `;

    tableBody.appendChild(row);
  });
}

function refreshFeedback() {
  const results = loadLatestRunResults();
  renderFeedbackTable(results);
}

document.addEventListener("DOMContentLoaded", () => {
  const schoolLevelInput = document.getElementById("schoolLevel");

  if (schoolLevelInput) {
    schoolLevelInput.addEventListener("change", refreshFeedback);
  }

  refreshFeedback();
});
