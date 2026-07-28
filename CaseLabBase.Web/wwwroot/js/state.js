

const API_BASE = "/api";

const SafeStorage = {
    getItem(key) {
        try {
            return sessionStorage.getItem(key);
        } catch (e) {
            return window._safeSessionState?.[key] || null;
        }
    },
    setItem(key, value) {
        try {
            sessionStorage.setItem(key, value);
        } catch (e) {
            if (!window._safeSessionState) window._safeSessionState = {};
            window._safeSessionState[key] = value;
        }
    },
    removeItem(key) {
        try {
            sessionStorage.removeItem(key);
        } catch (e) {
            if (window._safeSessionState) {
                delete window._safeSessionState[key];
            }
        }
    }
};

let state = {
    user: null, // Logged-in user DTO { id, name, role }
    activeTaskTitle: "Quiz 1: Elementary Math Basics",
    activeSelectedPresetOption: 1,
    activeRosterSubTab: "pending",
    activeMistakeSubTab: "mistakes",
    quizzes: [],

    questions: [], // Active questions retrieved from API
    studentAnswers: {}, // Student's typed responses
    studentSurvey: {}, // Survey ratings and notes
    flaggedQuestions: {}, // Questions flagged by student to revisit

    errorTags: [], // error tag templates
    chosenTag: null, // Error tag selected during grading
    activeGradingStudentID: null, // Student currently being evaluated

    currentExamQuestionIndex: 0, // Current active question index when taking exam
    examTimerInterval: null,
    examSecondsRemaining: 2394,

    timeLimitMinutes: 40,
    isQuizOpen: true,
    isForumOpen: true,
    deadlineString: null,
    pdfBase64: null,
    quizMode: "Manual",
    totalScore: 10.0
};

function isQuizActive() {
    if (!state.isQuizOpen) return false;
    if (state.deadlineString) {
        const deadline = parseLocalDateString(state.deadlineString);
        if (deadline && new Date() > deadline) return false;
    }
    return true;
}

// Transition between screen panels within a page
function switchLocalPanel(id) {
    document.querySelectorAll('.screen').forEach(s => {
        s.classList.remove('active');
    });
    const target = document.getElementById(id);
    if (target) {
        target.classList.add('active');
    }
}
