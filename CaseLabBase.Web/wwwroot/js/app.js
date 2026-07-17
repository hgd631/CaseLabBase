// CaseLab - Client Script (app.js)
const API_BASE = "http://localhost:5088/api";

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

    questions: [], // Active questions retrieved from API
    studentAnswers: {}, // Student's typed responses
    studentSurvey: {}, // Survey ratings and notes
    flaggedQuestions: {}, // Questions flagged by student to revisit

    errorTags: [], // Grow-As-You-Go error tag templates
    chosenTag: null, // Error tag selected during grading
    activeGradingStudentID: null, // Student currently being evaluated

    currentExamQuestionIndex: 0, // Current active question index when taking exam
    examTimerInterval: null,
    examSecondsRemaining: 2394, // 39:54

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

// Global user login handler
async function loginAsRole(userId) {
    try {
        const res = await fetch(`${API_BASE}/auth/users/${userId}`);
        if (!res.ok) throw new Error("Could not log in user.");

        state.user = await res.json();
        SafeStorage.setItem('caselab_user', JSON.stringify(state.user));

        if (state.user.role === 'student') {
            window.location.href = "/Student/Dashboard";
        } else {
            window.location.href = "/Instructor/Dashboard";
        }
    } catch (err) {
        alert(`Authentication Error: ${err.message}. Make sure the C# Web API is running on port 5088!`);
    }
}

function logoutSystem() {
    state.user = null;
    SafeStorage.removeItem('caselab_user');
    clearInterval(state.examTimerInterval);
    clearInterval(state._notifPollInterval);
    window.location.href = "/";
}

// ================= NOTIFICATION SYSTEM =================
//Member 1-Han: Implement notification polling, dropdown UI, and mark-all-read functionality.
async function fetchNotifications() { }
async function clickNotification(id, linkUrl) { }
function toggleNotifDropdown() { }
async function markAllNotifsRead() { }

// ================= STUDENT WORKSPACE FLOW =================

// Team Member 2 : Kelly - Load student-assigned quizzes and mistake banks, rendering status buttons based on submission records.
async function renderStudentDashboard() {
    const box = document.getElementById('assignmentContainerStudent');
    if (!box) return;

    try {
        const resQuizzes = await fetch(`${API_BASE}/questions/quizzes`);
        if (!resQuizzes.ok) throw new Error("Failed to load quizzes list.");
        const quizzes = await resQuizzes.json();

        if (quizzes.length === 0) {
            box.innerHTML = `
                <div class="p-4 text-center rounded glass-card" style="border-color: var(--border-color) !important;">
                    <span class="text-secondary small">📭 No active assignments published by the instructor.</span>
                </div>`;
            return;
        }

        box.innerHTML = "";
        let totalMistakesCount = 0;

        for (const quiz of quizzes) {
            const quizTitle = quiz.title || quiz.Title;
            const resBank = await fetch(`${API_BASE}/student/mistake-bank/${state.user.id}?quizTitle=${encodeURIComponent(quizTitle)}`);
            let badgeCount = 0;
            let submissionStatus = "NotStarted";
            let finalScore = 0;

            if (resBank.ok) {
                const dataBank = await resBank.json();
                finalScore = dataBank.finalScore;
                submissionStatus = dataBank.status;

                if (dataBank.status === "Graded") {
                    const hasErrors = dataBank.answers.some(a => a.isCorrect === false);
                    if (hasErrors) {
                        badgeCount = 1;
                        totalMistakesCount++;
                    }
                }
            }

            let statusHTML = "";
            const dl = quiz.deadlineString || quiz.DeadlineString;
            let deadlineHTML = "";
            if (dl) {
                const formatted = formatInReginaTimezone(dl);
                if (formatted) {
                    deadlineHTML = `<span class="text-secondary small d-block mt-1">📅 Due Date: ${formatted}</span>`;
                }
            }

            if (submissionStatus === "Pending") {
                statusHTML = `
                    <div class="d-flex justify-content-between align-items-center small p-3 rounded glass-card mb-3">
                        <div class="d-flex flex-column">
                            <span class="fw-semibold text-dark">${quizTitle}</span>
                            ${deadlineHTML}
                        </div>
                        <span class="badge-custom badge-custom-amber">✔ Submitted. Awaiting Grading.</span>
                    </div>`;
            } else if (submissionStatus === "Graded") {
                const mistakeBankLink = `/Student/MistakeBank?quizTitle=${encodeURIComponent(quizTitle)}`;
                statusHTML = `
                    <div class="d-flex justify-content-between align-items-center small p-3 rounded glass-card mb-3">
                        <div class="d-flex flex-column">
                            <span class="fw-semibold text-dark">${quizTitle}</span>
                            <span class="text-secondary small mt-1">Score: ${finalScore} / ${quiz.totalScore || quiz.TotalScore} pts</span>
                            ${deadlineHTML}
                        </div>
                        <div class="d-flex gap-2">
                            ${badgeCount > 0 ? `<button class="btn btn-danger btn-sm px-3" onclick="window.location.href='${mistakeBankLink}'">View Mistakes</button>` : `<button class="btn btn-outline-success btn-sm px-3" onclick="window.location.href='${mistakeBankLink}'">Review Passed</button>`}
                        </div>
                    </div>`;
            } else {
                let isOpen = quiz.isQuizOpen || quiz.IsQuizOpen;
                if (dl) {
                    const deadline = parseLocalDateString(dl);
                    if (deadline && new Date() > deadline) isOpen = false;
                }

                if (!isOpen) {
                    statusHTML = `
                        <div class="d-flex justify-content-between align-items-center p-3 rounded glass-card mb-3">
                            <div>
                                <strong class="text-dark d-block">${quizTitle}</strong>
                                <span class="text-secondary small d-block">This assessment is currently closed or has passed its deadline.</span>
                                ${deadlineHTML}
                            </div>
                            <button class="btn btn-secondary btn-sm px-4" disabled>Closed</button>
                        </div>`;
                } else {
                    statusHTML = `
                        <div class="d-flex justify-content-between align-items-center p-3 rounded glass-card mb-3">
                            <div>
                                <strong class="text-dark d-block">${quizTitle}</strong>
                                <span class="text-secondary small d-block">Time Allowed: ${quiz.timeLimitMinutes || quiz.TimeLimitMinutes} Minutes</span>
                                ${deadlineHTML}
                            </div>
                            <button class="btn btn-dark-custom btn-sm px-4" onclick="window.location.href='/Student/Exam?quizTitle=${encodeURIComponent(quizTitle)}'">Start Quiz</button>
                        </div>`;
                }
            }
            box.innerHTML += statusHTML;
        }

        const badge = document.getElementById('dashMistakeBadge');
        if (badge) badge.innerText = totalMistakesCount;
    } catch (err) {
        box.innerHTML = `<div class="alert-custom alert-custom-warning small">Error loading tasks: ${err.message}</div>`;
    }
}

// Team Member 2 Kelly - Load active quiz configuration details and initialize questions list layout.
async function loadQuestionsForExam() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const qTitle = urlParams.get('quizTitle');
        const titleQuery = qTitle ? `?quizTitle=${encodeURIComponent(qTitle)}` : "";

        const resQ = await fetch(`${API_BASE}/questions${titleQuery}`);
        if (!resQ.ok) throw new Error();
        const dataQ = await resQ.json();

        state.isQuizOpen = dataQ.isQuizOpen ?? true;
        state.deadlineString = dataQ.deadlineString ?? null;
        state.timeLimitMinutes = dataQ.timeLimitMinutes ?? 40;
        state.pdfBase64 = dataQ.pdfBase64 ?? null;
        state.quizMode = dataQ.quizMode ?? "Manual";
        state.totalScore = dataQ.totalScore ?? 10.0;

        if (!isQuizActive()) {
            alert("This assessment is currently closed or has passed its deadline.");
            window.location.href = "/Student/Dashboard";
            return;
        }

        state.activeTaskTitle = dataQ.title;
        state.questions = dataQ.questions;

        document.getElementById('examTitle').innerText = state.activeTaskTitle;
        openStudentExamForm();
    } catch (err) {
        alert("Failed to load questions.");
    }
}

function openStudentExamForm() {
    // Reset question navigation index
    state.currentExamQuestionIndex = 0;

    // Timer Reset
    state.examSecondsRemaining = state.timeLimitMinutes * 60;
    startExamTimer();

    const layoutArea = document.getElementById('examWorkspaceLayoutArea');
    if (!layoutArea) return;

    if (state.quizMode === "PDF") {
        const pdfSrc = state.pdfBase64.startsWith('data:') ? state.pdfBase64 : `data:application/pdf;base64,${state.pdfBase64}`;
        layoutArea.innerHTML = `
            <div class="col-lg-6">
                <div class="glass-panel p-0 overflow-hidden" style="height: 650px; border-color: rgba(124, 58, 237, 0.25) !important;">
                    <iframe src="${pdfSrc}" width="100%" height="100%" style="border: none;"></iframe>
                </div>
            </div>
            <div class="col-lg-6">
                <div class="row g-3">
                    <div class="col-md-4">
                        <div class="glass-panel p-3 mb-3" style="border-color: var(--border-color) !important;">
                            <h6 class="fw-bold text-dark mb-2" style="font-family: var(--font-heading); font-size: 13px;">📊 Progress</h6>
                            <div id="examProgressPercentageText" class="small text-secondary mb-2 fw-semibold" style="font-size: 11px;">0 / 0 (0%)</div>
                            <div class="progress mb-3" style="height: 4px; background-color: #f1f5f9;">
                                <div id="examProgressBarIndicator" class="progress-bar bg-success" role="progressbar" style="width: 0%;"></div>
                            </div>
                            <div id="examQuestionNavGrid" class="d-flex flex-wrap gap-2 overflow-y-auto" style="max-height: 480px;"></div>
                        </div>
                    </div>
                    <div class="col-md-8">
                        <div id="studentActiveQuestionsArea"></div>
                    </div>
                </div>
            </div>`;
    } else {
        layoutArea.innerHTML = `
            <div class="col-lg-3">
                <div class="glass-panel p-3 mb-3" style="border-color: var(--border-color) !important;">
                    <h6 class="fw-bold text-dark mb-2" style="font-family: var(--font-heading);">📊 Progress Grid</h6>
                    <div id="examProgressPercentageText" class="small text-secondary mb-2 fw-semibold">0 / 0 Answered (0%)</div>
                    <div class="progress mb-3" style="height: 6px; border-radius: 3px; background-color: #f1f5f9;">
                        <div id="examProgressBarIndicator" class="progress-bar bg-success" role="progressbar" style="width: 0%; border-radius: 3px;"></div>
                    </div>
                    <div id="examQuestionNavGrid" class="d-flex flex-wrap gap-2 overflow-y-auto" style="max-height: 250px;"></div>
                </div>
                <div class="glass-panel p-3" style="border-color: var(--border-color) !important;">
                    <h6 class="fw-bold text-dark mb-2" style="font-family: var(--font-heading);">Legend</h6>
                    <div class="d-flex flex-column gap-2 small">
                        <div class="d-flex align-items-center gap-2"><span class="badge bg-success" style="width:16px;height:16px;display:inline-block;"> </span> Answered</div>
                        <div class="d-flex align-items-center gap-2"><span class="badge bg-warning" style="width:16px;height:16px;display:inline-block;"> </span> Flagged to Revisit</div>
                        <div class="d-flex align-items-center gap-2"><span class="badge bg-secondary" style="width:16px;height:16px;display:inline-block;"> </span> Unanswered</div>
                    </div>
                </div>
            </div>
            <div class="col-lg-9">
                <div id="studentActiveQuestionsArea"></div>
            </div>`;
    }

    renderActiveQuestionCard();
}

function updateQuestionNavigationGrid() {
    const grid = document.getElementById('examQuestionNavGrid');
    if (!grid) return;

    let html = "";
    state.questions.forEach((q, idx) => {
        const isCurrent = idx === state.currentExamQuestionIndex;
        const isFlagged = state.flaggedQuestions[q.id] || false;

        let isAnswered = false;
        if (q.type === "MCQ") {
            isAnswered = !!state.studentAnswers[q.id];
        } else if (q.type === "Essay") {
            const textarea = document.getElementById(`active-student-essay-${q.id}`);
            const val = textarea ? textarea.value : (state.studentAnswers[q.id] || "");
            isAnswered = val.trim().length > 0;
        }

        let bgClass = "btn-outline-secondary text-secondary";
        let extraStyle = "";

        if (isCurrent) {
            extraStyle = "border: 2.5px solid var(--accent-purple) !important; font-weight: bold;";
        }

        if (isFlagged) {
            bgClass = "bg-warning text-dark border-warning";
        } else if (isAnswered) {
            bgClass = "bg-success text-white border-success";
        }

        const flagIndicator = isFlagged ? "🚩" : "";
        const dotIndicator = isAnswered && !isFlagged ? "●" : "";

        html += `
            <button onclick="switchToQuestion(${idx})" class="btn btn-sm ${bgClass} position-relative font-monospace" style="width: 45px; height: 45px; ${extraStyle}">
                ${idx + 1}
                ${flagIndicator ? `<span style="position: absolute; top: -5px; right: -5px; font-size: 10px;">${flagIndicator}</span>` : ""}
                ${dotIndicator ? `<span style="position: absolute; bottom: 2px; right: 2px; font-size: 8px;">${dotIndicator}</span>` : ""}
            </button>
        `;
    });

    grid.innerHTML = html;

    const answeredCount = state.questions.filter((q, idx) => {
        if (q.type === "MCQ") return !!state.studentAnswers[q.id];
        if (q.type === "Essay") {
            const textarea = document.getElementById(`active-student-essay-${q.id}`);
            const val = textarea ? textarea.value : (state.studentAnswers[q.id] || "");
            return val.trim().length > 0;
        }
        return false;
    }).length;

    const progressPercent = (answeredCount / state.questions.length) * 100;
    const progressText = document.getElementById('examProgressPercentageText');
    if (progressText) progressText.innerText = `${answeredCount} / ${state.questions.length} Answered (${Math.round(progressPercent)}%)`;

    const progressBar = document.getElementById('examProgressBarIndicator');
    if (progressBar) progressBar.style.width = `${progressPercent}%`;
}

function switchToQuestion(index) {
    if (index < 0 || index >= state.questions.length) return;

    const prevQ = state.questions[state.currentExamQuestionIndex];
    if (prevQ && prevQ.type === "Essay") {
        const textarea = document.getElementById(`active-student-essay-${prevQ.id}`);
        if (textarea) {
            state.studentAnswers[prevQ.id] = textarea.value;
        }
    }

    state.currentExamQuestionIndex = index;
    renderActiveQuestionCard();
}

function renderActiveQuestionCard() {
    const qArea = document.getElementById('studentActiveQuestionsArea');
    if (!qArea) return;

    const q = state.questions[state.currentExamQuestionIndex];
    const idx = state.currentExamQuestionIndex;

    const isFirst = idx === 0;
    const isLast = idx === state.questions.length - 1;
    const isFlagged = state.flaggedQuestions[q.id] || false;

    const savedAns = state.studentAnswers[q.id] || "";

    const labelText = state.quizMode === "PDF"
        ? `Question #${idx + 1} (${q.type})`
        : `Question #${idx + 1}: ${q.prompt}`;

    let html = `
        <div class="glass-card p-4 border border-secondary border-opacity-20 mb-3">
            <div class="d-flex justify-content-between align-items-start mb-3">
                <h5 class="fw-bold text-dark mb-0 me-3" style="flex: 1; line-height: 1.4; font-family: var(--font-heading);">${labelText}</h5>
                <button id="flag-btn-${q.id}" onclick="toggleFlagQuestion(${q.id})"
                    title="Flag this question to revisit later"
                    class="btn btn-sm ${isFlagged ? 'btn-warning text-dark' : 'btn-outline-secondary text-secondary'} d-flex align-items-center justify-content-center flex-shrink-0 gap-1"
                    style="border-radius: 6px; font-weight: bold; transition: all 0.2s;">
                    🚩 ${isFlagged ? 'Flagged' : 'Flag'}
                </button>
            </div>
    `;

    if (q.type === "MCQ") {
        html += `<div class="d-flex flex-column gap-2">`;
        const optionsList = state.quizMode === "PDF" ? ['A', 'B', 'C', 'D'] : q.options;

        optionsList.forEach(opt => {
            const optKey = state.quizMode === "PDF" ? opt : opt.trim().substring(0, 1);
            const isSelected = state.studentAnswers[q.id] === optKey;

            html += `
                <div class="mcq-option-card ${isSelected ? 'selected' : ''}" id="mcq-card-${q.id}-${optKey}" onclick="selectStudentMCQOption(${q.id}, '${optKey}')">
                    <div class="mcq-radio-dot ${isSelected ? 'selected' : ''}" id="mcq-dot-${q.id}-${optKey}"></div>
                    <span class="small">${state.quizMode === "PDF" ? `Option ${opt}` : opt}</span>
                </div>`;
        });
        html += `</div>`;
    } else if (q.type === "Essay") {
        html += `
            <div class="code-editor-wrapper">
                <div class="code-editor-header">
                    <div class="code-editor-dots">
                        <div class="code-editor-dot dot-red"></div>
                        <div class="code-editor-dot dot-yellow"></div>
                        <div class="code-editor-dot dot-green"></div>
                    </div>
                    <span class="text-secondary small font-monospace">index.js</span>
                </div>
                <textarea class="form-control code-input" id="active-student-essay-${q.id}" rows="8" 
                    oninput="state.studentAnswers[${q.id}] = this.value; updateQuestionNavigationGrid();"
                    placeholder="// Type your answer here...">${savedAns}</textarea>
            </div>`;
    }

    html += `
        </div>
        <div class="d-flex justify-content-between align-items-center mt-3 flex-wrap gap-2">
            <button class="btn btn-sm btn-outline-custom" ${isFirst ? 'disabled' : ''} onclick="switchToQuestion(${idx - 1})">
                ◀ Previous
            </button>
            <span class="text-secondary small fw-semibold font-monospace">Question ${idx + 1} of ${state.questions.length}</span>
            ${isLast ? `
            <button class="btn btn-sm btn-success fw-bold" onclick="lockExamAndOpenSurvey()">
                Submit Quiz & Continue ▶
            </button>
            ` : `
            <button class="btn btn-sm btn-dark-custom" onclick="switchToQuestion(${idx + 1})">
                Next Question ▶
            </button>
            `}
        </div>
    `;

    qArea.innerHTML = html;
    updateQuestionNavigationGrid();
}

// Toggle flag on a question card
function toggleFlagQuestion(qId) {
    state.flaggedQuestions[qId] = !state.flaggedQuestions[qId];
    const isFlagged = state.flaggedQuestions[qId];

    const btn = document.getElementById(`flag-btn-${qId}`);
    if (btn) {
        if (isFlagged) {
            btn.className = "btn btn-sm btn-warning text-dark d-flex align-items-center justify-content-center flex-shrink-0 gap-1";
            btn.innerHTML = "🚩 Flagged";
        } else {
            btn.className = "btn btn-sm btn-outline-secondary text-secondary d-flex align-items-center justify-content-center flex-shrink-0 gap-1";
            btn.innerHTML = "🚩 Flag";
        }
    }

    updateQuestionNavigationGrid();
}

function selectStudentMCQOption(qId, key) {
    const q = state.questions.find(quest => quest.id === qId);
    if (!q) return;

    const optList = state.quizMode === "PDF" ? ['A', 'B', 'C', 'D'] : q.options;

    optList.forEach(opt => {
        const k = state.quizMode === "PDF" ? opt : opt.trim().substring(0, 1);
        const card = document.getElementById(`mcq-card-${qId}-${k}`);
        if (card) card.classList.remove('selected');
        const dot = document.getElementById(`mcq-dot-${qId}-${k}`);
        if (dot) dot.classList.remove('selected');
    });

    const selectedCard = document.getElementById(`mcq-card-${qId}-${key}`);
    if (selectedCard) selectedCard.classList.add('selected');
    const selectedDot = document.getElementById(`mcq-dot-${qId}-${key}`);
    if (selectedDot) selectedDot.classList.add('selected');

    state.studentAnswers[qId] = key;
    updateQuestionNavigationGrid();
}

function startExamTimer() {
    clearInterval(state.examTimerInterval);
    state.examTimerInterval = setInterval(() => {
        state.examSecondsRemaining--;
        if (state.examSecondsRemaining <= 0) {
            clearInterval(state.examTimerInterval);
            alert("Time has expired! Submitting your work automatically.");
            lockExamAndOpenSurvey();
            return;
        }

        const minutes = Math.floor(state.examSecondsRemaining / 60);
        const seconds = state.examSecondsRemaining % 60;
        const display = document.getElementById('examTimerDisplay');
        if (display) {
            display.innerText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }, 1000);
}

function lockExamAndOpenSurvey() {
    clearInterval(state.examTimerInterval);

    state.questions.forEach(q => {
        if (q.type === "Essay") {
            const el = document.getElementById(`active-student-essay-${q.id}`);
            if (el) {
                state.studentAnswers[q.id] = el.value;
            }
        }
    });

    switchLocalPanel('screen-student-exam');
    switchLocalPanel('screen-student-survey');

    state.studentSurveyOverall = { difficulty: "Medium", note: "" };
}

function selectOverallDifficulty(level) {
    const opts = ['easy', 'medium', 'hard'];
    opts.forEach(o => {
        const btn = document.getElementById(`emoji-${o}-overall`);
        if (btn) btn.classList.remove('selected');
    });

    const selectedBtn = document.getElementById(`emoji-${level.toLowerCase()}-overall`);
    if (selectedBtn) selectedBtn.classList.add('selected');

    if (!state.studentSurveyOverall) state.studentSurveyOverall = {};
    state.studentSurveyOverall.difficulty = level;
}

// FIXED: Collect reflections from UI inputs into state before preparing the payload
async function completeSurveyPipeline() {
    const commentVal = document.getElementById('survey-comment-overall')?.value || "";
    const diffVal = state.studentSurveyOverall?.difficulty || "Medium";

    try {
        const examPayload = {
            studentId: state.user.id,
            quizTitle: state.activeTaskTitle,
            answers: Object.keys(state.studentAnswers).map(qid => ({
                questionId: parseInt(qid),
                studentAnswer: state.studentAnswers[qid]
            }))
        };

        const resExam = await fetch(`${API_BASE}/student/submit-exam`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(examPayload)
        });

        if (!resExam.ok) {
            let errMsg = `HTTP ${resExam.status}`;
            try {
                const errBody = await resExam.json();
                errMsg = errBody.error || errBody.Error || errBody.title || JSON.stringify(errBody);
            } catch (_) { }
            throw new Error(`Exam submit failed: ${errMsg}`);
        }

        const surveyPayload = {
            studentId: state.user.id,
            quizTitle: state.activeTaskTitle,
            difficulty: diffVal,
            commentNote: commentVal
        };

        const resSurvey = await fetch(`${API_BASE}/student/submit-survey`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(surveyPayload)
        });

        if (!resSurvey.ok) {
            let errMsg = `HTTP ${resSurvey.status}`;
            try {
                const errBody = await resSurvey.json();
                errMsg = errBody.error || errBody.Error || errBody.title || JSON.stringify(errBody);
            } catch (_) { }
            throw new Error(`Survey submit failed: ${errMsg}`);
        }

        alert("✔ Submitted successfully!");
        window.location.href = "/Student/Dashboard";
    } catch (err) {
        alert(`Error submitting results: ${err.message}`);
    }
}

// ================= STUDENT MISTAKE BANK =================

function onMistakeQuizDropdownChange(val) {
    state.selectedQuizTitle = val;
    const newUrl = window.location.pathname + '?quizTitle=' + encodeURIComponent(val);
    window.history.pushState({ path: newUrl }, '', newUrl);
    openStudentMistakeBankWithReload();
}

async function openStudentMistakeBankWithReload() {
    const container = document.getElementById('mistakeBankCoreContent');
    if (!container) return;
    container.innerHTML = "";

    try {
        // Fetch all quizzes to populate the selector
        const resQuizzes = await fetch(`${API_BASE}/questions/quizzes`);
        if (!resQuizzes.ok) throw new Error("Failed to load quizzes list.");
        const quizzes = await resQuizzes.json();

        if (quizzes.length === 0) {
            container.innerHTML = `
                <div class="glass-panel text-center py-5">
                    <h5 class="fw-semibold text-secondary">No quizzes published yet.</h5>
                </div>`;
            return;
        }

        const urlParams = new URLSearchParams(window.location.search);
        let qTitle = urlParams.get('quizTitle') || state.selectedQuizTitle || state.activeTaskTitle;

        // Default to first quiz if not set or not found
        if (!qTitle || !quizzes.some(q => (q.title || q.Title) === qTitle)) {
            qTitle = quizzes[0].title || quizzes[0].Title;
        }

        state.selectedQuizTitle = qTitle;

        // Fetch mistakes count for each quiz in parallel
        const quizPromises = quizzes.map(async (q) => {
            const title = q.title || q.Title;
            let mistakesCount = 0;
            try {
                const res = await fetch(`${API_BASE}/student/mistake-bank/${state.user.id}?quizTitle=${encodeURIComponent(title)}`);
                if (res.ok) {
                    const dataBank = await res.json();
                    if (dataBank.status === "Graded") {
                        mistakesCount = dataBank.answers.filter(a => a.isCorrect === false).length;
                    }
                }
            } catch (_) { }
            return { quiz: q, mistakes: mistakesCount };
        });
        const quizzesWithMistakes = await Promise.all(quizPromises);

        // Generate dropdown selector HTML
        const selectOptionsHTML = quizzesWithMistakes.map(item => {
            const title = item.quiz.title || item.quiz.Title;
            return `<option value="${title}" ${title === qTitle ? 'selected' : ''}>${title} (${item.mistakes})</option>`;
        }).join('');

        const selectorHTML = `
            <div class="glass-panel p-3 mb-4 d-flex align-items-center gap-3">
                <span class="text-secondary small fw-bold text-uppercase d-flex align-items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    Select Quiz Context:
                </span>
                <select id="mistakeQuizSelectDropdown" class="form-select form-select-sm bg-white text-dark" style="max-width: 320px;" onchange="onMistakeQuizDropdownChange(this.value)">
                    ${selectOptionsHTML}
                </select>
            </div>`;

        const titleQuery = `?quizTitle=${encodeURIComponent(qTitle)}`;

        const resQ = await fetch(`${API_BASE}/questions${titleQuery}`);
        if (resQ.ok) {
            const dataQ = await resQ.json();
            state.quizMode = dataQ.quizMode ?? "Manual";
            state.activeTaskTitle = dataQ.title;
            state.totalScore = dataQ.totalScore ?? 10.0;
            state.deadlineString = dataQ.deadlineString || dataQ.DeadlineString;
        }

        const res = await fetch(`${API_BASE}/student/mistake-bank/${state.user.id}${titleQuery}`);
        if (!res.ok) {
            container.innerHTML = selectorHTML + `
                <div class="glass-panel text-center py-5">
                    <h5 class="fw-semibold text-secondary">No grading reviews are available for your submissions yet for "${qTitle}".</h5>
                </div>`;
            return;
        }

        const data = await res.json();

        // Separate correct and incorrect answers
        const incorrectAnswers = data.answers.filter(a => a.isCorrect === false);
        const correctAnswers = data.answers.filter(a => a.isCorrect === true);

        let isPastDeadline = false;
        if (state.deadlineString) {
            const deadline = parseLocalDateString(state.deadlineString);
            if (deadline && new Date() > deadline) {
                isPastDeadline = true;
            }
        }

        let disputeCardHTML = "";
        if (data.status === "Graded") {
            if (data.disputeStatus === "None") {
                disputeCardHTML = `
                    <div class="glass-panel p-4 border rounded bg-white shadow-sm text-center" style="border-color: rgba(220, 38, 38, 0.2) !important;">
                        <h5 class="fw-bold text-dark mb-2">💬 Grade Audit & Private Dispute Dialogue</h5>
                        <p class="text-secondary small mb-4">If you believe there is a grading anomaly in this submission, you can open a private 1-on-1 dialogue with your professor to audit your answers.</p>
                        <button class="btn btn-dark-custom px-5 py-2.5 fw-bold" onclick="initiateStudentSubmissionDispute()" ${isPastDeadline ? 'disabled' : ''}>
                            ⚠️ Open Private Grade Dispute Thread
                        </button>
                        ${isPastDeadline ? `<span class="text-rose small d-block mt-3 font-semibold">🔒 Disputes locked: Due Date has passed.</span>` : ''}
                    </div>`;
            } else {
                disputeCardHTML = `
                    <div class="glass-panel p-3 border rounded bg-white shadow-sm">
                        <h6 class="fw-bold text-dark border-bottom pb-2 mb-3 d-flex justify-content-between align-items-center" style="font-family: var(--font-heading);">
                            <span>💬 Submission Dispute Room (Private Dialogue)</span>
                            ${data.disputeStatus === 'PendingReview'
                        ? '<span class="badge bg-warning text-dark">Awaiting Professor Audit</span>'
                        : (data.disputeStatus === 'Resolved_Accepted'
                            ? '<span class="badge bg-success">Dispute Approved & Scores Overridden</span>'
                            : '<span class="badge bg-danger">Dispute Resolved (Initial Evaluation Sustained)</span>')}
                        </h6>
                        <div class="chat-window">
                            <div class="chat-header">Dialogue Stream with Dr. Ali Bayeh</div>
                            <div class="p-3">
                                <div id="studentUnifiedDisputeChatStream" class="chat-message-stream mb-3" style="height: 220px; overflow-y: auto;">
                                    <!-- Chat messages loaded here -->
                                </div>
                                ${(!isPastDeadline && data.disputeStatus === 'PendingReview') ? `
                                <div class="input-group">
                                    <input type="text" id="inputStudentUnifiedDisputeMessage" class="form-control" placeholder="Type a message to your professor...">
                                    <button class="btn btn-dark-custom" onclick="sendStudentUnifiedDisputeMessage()">Send</button>
                                </div>` : `
                                <div class="alert-custom alert-custom-warning small text-center mb-0">
                                    🔒 This dialogue room is closed ${isPastDeadline ? '(Due Date has passed)' : '(Dispute has been resolved)'}.
                                </div>`}
                            </div>
                        </div>
                    </div>`;
            }
        } else {
            disputeCardHTML = `
                <div class="alert-custom alert-custom-warning text-center small py-4">
                    🕒 This quiz has not been graded yet. Disputes can only be opened after grading is completed.
                </div>`;
        }

        let headerHTML = `
            <div class="mb-4 p-3 border rounded bg-light" style="border-color: var(--border-color) !important;">
                <h5 class="fw-bold mb-1 text-dark" style="font-family: var(--font-heading);">${state.activeTaskTitle}</h5>
                <div class="d-flex justify-content-between align-items-center mt-2 flex-wrap gap-2">
                    <span class="text-secondary small">Submission Status: <span class="badge-custom badge-custom-emerald">${data.status}</span></span>
                    <strong class="text-indigo font-monospace" style="font-size: 15px;">Final Score Registry: ${data.finalScore} / ${state.totalScore} pts</strong>
                </div>
            </div>`;

        const subTabsHTML = `
            <ul class="nav nav-pills nav-fill mb-4 border p-1 rounded bg-white shadow-sm" style="border-color: var(--border-color) !important;">
                <li class="nav-item">
                    <button class="nav-link active fw-bold text-uppercase small py-2.5" id="mistake-tab-btn" onclick="switchMistakeBankSubTab('mistakes')">
                        ⚠️ Defect Cards (${incorrectAnswers.length})
                    </button>
                </li>
                <li class="nav-item">
                    <button class="nav-link fw-bold text-uppercase small py-2.5" id="passed-tab-btn" onclick="switchMistakeBankSubTab('passed')">
                        🟢 Passed Items (${correctAnswers.length})
                    </button>
                </li>
                <li class="nav-item">
                    <button class="nav-link fw-bold text-uppercase small py-2.5" id="dispute-tab-btn" onclick="switchMistakeBankSubTab('disputes')">
                        💬 Dispute Dialogue ${data.disputeStatus !== 'None' ? `(Active)` : ''}
                    </button>
                </li>
            </ul>
        `;

        let mistakesHTML = `
            <div id="panel-student-mistakes" class="mb-4">
                <h5 class="fw-bold text-rose mb-3" style="font-family: var(--font-heading);">
                    ⚠️ Mistake Bank - Active Defects (${incorrectAnswers.length})
                </h5>`;
        if (incorrectAnswers.length === 0) {
            mistakesHTML += `
                <div class="alert-custom alert-custom-success small text-center py-4">
                    🎉 Excellent work! No defect tags are currently active for this assignment cycle.
                </div>`;
        } else {
            incorrectAnswers.forEach(q => {
                const qIdx = data.answers.findIndex(ans => ans.questionId === q.questionId);
                const questionIndex = qIdx >= 0 ? qIdx + 1 : q.questionId;

                mistakesHTML += `
                    <div class="glass-card mb-3 border-start border-3 border-danger">
                        <div class="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
                            <span class="badge-custom badge-custom-cyan">Question #${questionIndex} | Topic: ${q.questionTopic}</span>
                            <span class="badge-custom badge-custom-rose">❌ Defect Tag Applied</span>
                        </div>`;
                if (state.quizMode !== "PDF") {
                    mistakesHTML += `<h6 class="fw-bold text-dark mb-2">${q.questionPrompt}</h6>`;
                }
                mistakesHTML += `
                        <div class="small text-secondary mb-1">Your Submission Output:</div>
                        <pre class="p-2 code-input rounded small mb-3" style="background: #0f172a; color: #38bdf8; border: 1px solid var(--border-color); font-family: monospace; opacity: 1;">${q.studentAnswer || '[Empty Answer]'}</pre>
                        
                        <div class="review-block p-3 rounded bg-light border border-secondary border-opacity-10 mb-2">
                            <div class="small text-secondary mb-2">Your difficulty rating: <span class="badge bg-secondary">${q.difficulty || 'Medium'}</span></div>
                            <div class="small text-secondary mb-2">Your comments/pain points: <em>"${q.commentNote || 'No notes.'}"</em></div>`;

                if (q.questionType === "MCQ") {
                    mistakesHTML += `
                        <span class="text-rose fw-semibold small d-block">❌ Auto-Graded Check: Incorrect response.</span>
                        <p class="text-secondary small mb-0 mt-1">Your response: Option "${q.studentAnswer}". Correct answer key: <strong>Option ${q.correctKey || 'B'}</strong>.</p>`;
                } else if (q.questionType === "Essay") {
                    mistakesHTML += `
                        <span class="text-rose fw-semibold small d-block">❌ Defect Card Details Applied:</span>
                        <div class="my-2">
                            <span class="badge bg-danger fs-6 text-white">${q.teacherTag || 'Pending check'}</span>
                        </div>
                        ${q.teacherFeedback ? `
                        <div class="my-2 p-2.5 border border-warning rounded bg-warning-subtle text-dark small font-monospace" style="border-color: rgba(217, 119, 6, 0.25) !important;">
                            <strong>👨‍🏫 Instructor Feedback Note:</strong> "${q.teacherFeedback}"
                        </div>` : ''}
                        <p class="text-secondary small mb-0 mt-3"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" class="me-1" style="display:inline-block; vertical-align:text-bottom;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Visit the Course Forum to view discussion threads and shared study materials.</p>`;
                }
                mistakesHTML += `</div></div>`;
            });
        }
        mistakesHTML += `</div>`;

        let passedHTML = `
            <div id="panel-student-passed" class="mb-4 d-none">
                <h5 class="fw-bold text-emerald mb-3" style="font-family: var(--font-heading);">
                    🟢 Passed Items Review (${correctAnswers.length})
                </h5>`;
        if (correctAnswers.length === 0) {
            passedHTML += `
                <div class="text-secondary small italic p-4 bg-light rounded text-center border">
                    No fully passed items registered for this workspace review.
                </div>`;
        } else {
            correctAnswers.forEach(q => {
                const qIdx = data.answers.findIndex(ans => ans.questionId === q.questionId);
                const questionIndex = qIdx >= 0 ? qIdx + 1 : q.questionId;

                passedHTML += `
                    <div class="glass-card mb-3 border-start border-3 border-success opacity-85">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <span class="badge-custom badge-custom-cyan">Question #${questionIndex} | Topic: ${q.questionTopic}</span>
                            <span class="badge-custom badge-custom-emerald">🟢 Passed</span>
                        </div>`;
                if (state.quizMode !== "PDF") {
                    passedHTML += `<h6 class="fw-bold text-dark mb-2">${q.questionPrompt}</h6>`;
                }
                passedHTML += `
                        <div class="small text-secondary mb-1">Your Submission Output:</div>
                        <pre class="p-2 code-input rounded small mb-3" style="background: #0f172a; color: #38bdf8; border: 1px solid var(--border-color); font-family: monospace; opacity: 1;">${q.studentAnswer || '[Empty Answer]'}</pre>
                        
                        <div class="review-block p-3 rounded bg-light border border-secondary border-opacity-10">
                            <div class="small text-secondary mb-2">Your difficulty rating: <span class="badge bg-secondary">${q.difficulty || 'Medium'}</span></div>
                            <div class="small text-secondary">Your comments/pain points: <em>"${q.commentNote || 'No notes.'}"</em></div>
                        </div>
                    </div>`;
            });
        }
        passedHTML += `</div>`;

        let disputesPanelHTML = `
            <div id="panel-student-disputes" class="mb-4 d-none">
                ${disputeCardHTML}
            </div>`;

        container.innerHTML = selectorHTML + headerHTML + subTabsHTML + mistakesHTML + passedHTML + disputesPanelHTML;

        // Restore tab active state if set
        if (state.activeMistakeSubTab) {
            switchMistakeBankSubTab(state.activeMistakeSubTab);
        }

        if (data.disputeStatus && data.disputeStatus !== "None") {
            loadStudentUnifiedDisputeChat();
        }
        renderStudentEmbeddedPrivateChatArea(data.answers);
    } catch (err) {
        container.innerHTML = `<div class="alert-custom alert-custom-warning small">Error loading review desk: ${err.message}</div>`;
    }
}

function switchMistakeBankSubTab(tab) {
    state.activeMistakeSubTab = tab;

    const mistakeBtn = document.getElementById('mistake-tab-btn');
    const passedBtn = document.getElementById('passed-tab-btn');
    const disputeBtn = document.getElementById('dispute-tab-btn');

    const mistakePanel = document.getElementById('panel-student-mistakes');
    const passedPanel = document.getElementById('panel-student-passed');
    const disputePanel = document.getElementById('panel-student-disputes');

    if (mistakeBtn) mistakeBtn.classList.remove('active');
    if (passedBtn) passedBtn.classList.remove('active');
    if (disputeBtn) disputeBtn.classList.remove('active');

    if (mistakePanel) mistakePanel.classList.add('d-none');
    if (passedPanel) passedPanel.classList.add('d-none');
    if (disputePanel) disputePanel.classList.add('d-none');

    if (tab === 'mistakes') {
        if (mistakeBtn) mistakeBtn.classList.add('active');
        if (mistakePanel) mistakePanel.classList.remove('d-none');
    } else if (tab === 'passed') {
        if (passedBtn) passedBtn.classList.add('active');
        if (passedPanel) passedPanel.classList.remove('d-none');
    } else if (tab === 'disputes') {
        if (disputeBtn) disputeBtn.classList.add('active');
        if (disputePanel) disputePanel.classList.remove('d-none');
    }
}

async function initiateStudentSubmissionDispute() {
    const reason = prompt("Enter your dispute reason statement to start a private 1-on-1 chat thread with your instructor for this entire submission:");
    if (!reason) return;

    try {
        const payload = {
            studentId: state.user.id,
            quizTitle: state.selectedQuizTitle || state.activeTaskTitle,
            message: reason
        };

        const res = await fetch(`${API_BASE}/student/initiate-submission-dispute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Failed to open dispute.");

        alert("Dispute dialogue successfully opened.");
        openStudentMistakeBankWithReload();
    } catch (err) {
        alert(`Error opening dispute: ${err.message}`);
    }
}

async function loadStudentUnifiedDisputeChat() {
    const streamContainer = document.getElementById('studentUnifiedDisputeChatStream');
    if (!streamContainer) return;

    try {
        const topic = `Dispute ${state.user.id} - ${state.selectedQuizTitle || state.activeTaskTitle}`;
        const res = await fetch(`${API_BASE}/forum/dispute/${state.user.id}/${encodeURIComponent(topic)}`);
        if (!res.ok) throw new Error();

        const comments = await res.json();
        streamContainer.innerHTML = comments.map(c => {
            const isSelf = c.sender.includes(state.user.name);
            return `
                <div class="comment-bubble ${isSelf ? 'self' : ''}">
                    <span class="d-block small fw-bold" style="color: var(--accent-cyan); font-size: 11px;">${c.sender}</span>
                    <span style="font-size: 12.5px;">${c.message}</span>
                </div>`;
        }).join('');

        streamContainer.scrollTop = streamContainer.scrollHeight;
    } catch (err) {
        streamContainer.innerHTML = `<div class="text-center text-secondary small py-3">Error loading messages.</div>`;
    }
}

async function sendStudentUnifiedDisputeMessage() {
    const field = document.getElementById('inputStudentUnifiedDisputeMessage');
    if (!field || !field.value.trim()) return;

    try {
        const topic = `Dispute ${state.user.id} - ${state.selectedQuizTitle || state.activeTaskTitle}`;
        const payload = {
            isPrivate: true,
            studentId: state.user.id,
            topic: topic,
            sender: `${state.user.name} (Student)`,
            message: field.value.trim()
        };

        const res = await fetch(`${API_BASE}/forum/comment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Failed to send message.");

        field.value = "";
        await loadStudentUnifiedDisputeChat();
    } catch (err) {
        alert(err.message);
    }
}

// Member Han - Student dispute ticketing and private chat operations
async function initiateStudentDisputeTicket(qId) {
    const reason = prompt("Enter your dispute reason statement to start a private 1-on-1 chat thread with your instructor:");
    if (!reason) return;

    try {
        const payload = {
            studentId: state.user.id,
            questionId: qId,
            message: reason
        };

        const res = await fetch(`${API_BASE}/student/initiate-dispute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Failed to open dispute ticket.");

        alert("Dispute ticket successfully created. A private dialogue has been opened.");
        openStudentMistakeBankWithReload();
    } catch (err) {
        alert(`Error opening dispute: ${err.message}`);
    }
}

async function renderStudentEmbeddedPrivateChatArea(answers) {
    for (const q of answers) {
        const area = document.getElementById(`studentEmbeddedPrivateChatZoneArea-${q.questionId}`);
        if (!area) continue;

        try {
            const res = await fetch(`${API_BASE}/forum/dispute/${state.user.id}/Dispute Q${q.questionId}`);
            if (!res.ok) continue;

            const comments = await res.json();

            const chatStream = comments.map(c => {
                const isSelf = c.sender.includes(state.user.name);
                return `<div class="comment-bubble ${isSelf ? 'self' : ''}">
                    <span class="d-block small fw-bold" style="color: var(--accent-cyan); font-size: 11px;">${c.sender}</span>
                    <span style="font-size: 12.5px;">${c.message}</span>
                </div>`;
            }).join('');

            let disputeStatusText = `<span class="badge-custom badge-custom-amber">Awaiting Instructor Audit</span>`;

            const resScore = await fetch(`${API_BASE}/student/mistake-bank/${state.user.id}`);
            if (resScore.ok) {
                const sData = await resScore.json();
                if (sData.disputeStatus === "Resolved_Accepted") {
                    disputeStatusText = `<span class="badge-custom badge-custom-emerald">Dispute Approved: Overridden Score Active</span>`;
                } else if (sData.disputeStatus === "Resolved_Rejected") {
                    disputeStatusText = `<span class="badge-custom badge-custom-rose">Dispute Denied</span>`;
                }
            }

            area.innerHTML = `
                <div class="chat-window p-3 mt-3">
                    <div class="d-flex justify-content-between align-items-center mb-3 text-secondary border-bottom border-secondary pb-2 small">
                        <strong>🔒 Private Dispute Room</strong>
                        ${disputeStatusText}
                    </div>
                    <div class="chat-message-stream mb-3">${chatStream}</div>
                    ${disputeStatusText.includes('Audit') ? `
                    <div class="input-group input-group-sm">
                        <input type="text" id="inputStudentEmbeddedComment-${q.questionId}" class="form-control" placeholder="Type reply...">
                        <button class="btn btn-dark-custom btn-sm" onclick="dispatchStudentEmbeddedChat(${q.questionId})">Send</button>
                    </div>` : ''}
                </div>`;
        } catch (err) {
            console.error(err);
        }
    }
}

async function dispatchStudentEmbeddedChat(qId) {
    const val = document.getElementById(`inputStudentEmbeddedComment-${qId}`).value;
    if (!val) return;

    try {
        const payload = {
            isPrivate: true,
            studentId: state.user.id,
            topic: "Dispute Q" + qId,
            sender: `${state.user.name} (Student)`,
            message: val
        };

        const res = await fetch(`${API_BASE}/forum/comment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Failed to send message.");

        openStudentMistakeBankWithReload();
    } catch (err) {
        alert(err.message);
    }
}

//Member 1-Han: Load quizzes list from API, render sidebar buttons, and handle quiz selection state.
async function loadQuizzesSidebar() {
    const sidebar = document.getElementById('quizListSidebarContainer');
    if (!sidebar) return;

    try {
        const res = await fetch(`${API_BASE}/questions/quizzes`);
        if (!res.ok) throw new Error("Failed to fetch quizzes list.");
        state.quizzes = await res.json();

        if (state.quizzes.length === 0) {
            sidebar.innerHTML = `<div class="text-center py-3 text-secondary small">No quizzes published.</div>`;
            return;
        }

        if (!state.selectedQuizTitle && state.quizzes.length > 0) {
            state.selectedQuizTitle = state.quizzes[0].Title || state.quizzes[0].title;
        }

        sidebar.innerHTML = "";
        state.quizzes.forEach(quiz => {
            const title = quiz.title || quiz.Title;
            const isSelected = state.selectedQuizTitle === title;

            const btn = document.createElement('button');
            btn.className = `btn btn-sm text-start p-2.5 rounded border border-secondary border-opacity-15 w-100 d-flex flex-column gap-1 transition-all`;
            btn.style.backgroundColor = isSelected ? "var(--accent-indigo)" : "#ffffff";
            btn.style.color = isSelected ? "#ffffff" : "var(--text-color)";

            btn.innerHTML = `
                <strong class="small text-wrap d-block text-start" style="font-size:12px; line-height:1.2; font-weight:600;">${title}</strong>
                <span class="small opacity-75 d-block text-start" style="font-size: 10px; margin-top:2px;">Points: ${quiz.totalScore || quiz.TotalScore} pts | Mode: ${quiz.quizMode || quiz.QuizMode}</span>
            `;

            btn.onclick = () => {
                selectQuizFromSidebar(title);
            };
            sidebar.appendChild(btn);
        });
    } catch (err) {
        sidebar.innerHTML = `<div class="alert-custom alert-custom-warning small">Error loading quizzes.</div>`;
    }
}

async function selectQuizFromSidebar(title) {
    state.selectedQuizTitle = title;

    const quiz = state.quizzes.find(q => (q.title || q.Title) === title);
    if (quiz) {
        state.activeTaskTitle = quiz.title || quiz.Title;
        state.timeLimitMinutes = quiz.timeLimitMinutes || quiz.TimeLimitMinutes;
        state.isQuizOpen = quiz.isQuizOpen || quiz.IsQuizOpen;
        state.isForumOpen = quiz.isForumOpen || quiz.IsForumOpen;
        state.deadlineString = quiz.deadlineString || quiz.DeadlineString;
        state.pdfBase64 = quiz.pdfBase64 || quiz.PdfBase64;
        state.quizMode = quiz.quizMode || quiz.QuizMode;
        state.totalScore = quiz.totalScore || quiz.TotalScore;
    }

    // Toggle panels
    const placeholder = document.getElementById('teacherDashboardEmptyPlaceholder');
    if (placeholder) placeholder.classList.add('d-none');
    const createContainer = document.getElementById('quizCreateViewContainer');
    if (createContainer) createContainer.classList.add('d-none');
    const selectedContainer = document.getElementById('quizSelectedViewContainer');
    if (selectedContainer) selectedContainer.classList.remove('d-none');

    const headerTitle = document.getElementById('activeQuizTitleHeader');
    if (headerTitle) headerTitle.innerText = state.activeTaskTitle;

    await loadQuizzesSidebar();
    await switchQuizSubTab(state.activeQuizSubTab || 'view');
}

function enterCreateQuizMode() {
    state.selectedQuizTitle = null;
    state.activeTaskTitle = "";
    state.timeLimitMinutes = 40;
    state.totalScore = 10.0;
    state.deadlineString = "";
    state.isQuizOpen = true;
    state.isForumOpen = true;
    state.pdfBase64 = null;
    state.quizMode = "Manual";
    state.questions = []; // Blank questions array

    // Deselect sidebar buttons
    document.querySelectorAll('#quizListSidebarContainer button').forEach(b => {
        b.style.backgroundColor = "#ffffff";
        b.style.color = "var(--text-color)";
    });

    const placeholder = document.getElementById('teacherDashboardEmptyPlaceholder');
    if (placeholder) placeholder.classList.add('d-none');
    const selectedContainer = document.getElementById('quizSelectedViewContainer');
    if (selectedContainer) selectedContainer.classList.add('d-none');
    const createContainer = document.getElementById('quizCreateViewContainer');
    if (createContainer) createContainer.classList.remove('d-none');

    // Reset create form inputs to blank
    document.getElementById('inputTaskTitle').value = "";
    document.getElementById('inputQuizTimeLimit').value = 40;
    document.getElementById('inputQuizTotalScore').value = 10.0;
    document.getElementById('inputQuizDeadline').value = "";
    document.getElementById('inputIsQuizOpen').checked = true;
    document.getElementById('inputIsForumOpen').checked = true;
    document.getElementById('inputQuizMode').value = "Manual";
    document.getElementById('pdfUploadWrapper').classList.add('d-none');
    document.getElementById('quizPdfStatusLabel').innerText = "No PDF document attached.";

    const container = document.getElementById('custom-questions-list-container');
    if (container) container.innerHTML = "";
}

async function switchQuizSubTab(subTab) {
    state.activeQuizSubTab = subTab;
    document.querySelectorAll('#quizSubTabs .nav-link-custom').forEach(l => l.classList.remove('active'));
    document.querySelectorAll('.quiz-sub-tab-content').forEach(c => c.classList.add('d-none'));

    const tabBtn = document.getElementById(`quiz-sub-btn-${subTab}`);
    if (tabBtn) tabBtn.classList.add('active');

    const tabContent = document.getElementById(`quiz-sub-tab-content-${subTab}`);
    if (tabContent) tabContent.classList.remove('d-none');

    if (subTab === 'view') {
        await renderViewQuizQuestions();
    } else if (subTab === 'grading') {
        await switchRosterSubTab(state.activeRosterSubTab || 'pending');
    } else if (subTab === 'diagnostics') {
        await loadInstructorAnalytics();
    }
}

async function renderViewQuizQuestions() {
    const container = document.getElementById('viewQuizQuestionsContainer');
    if (!container) return;
    container.innerHTML = "";

    try {
        const titleQuery = state.selectedQuizTitle ? `?quizTitle=${encodeURIComponent(state.selectedQuizTitle)}` : "";
        const res = await fetch(`${API_BASE}/questions${titleQuery}`);
        if (!res.ok) {
            container.innerHTML = `<div class="text-center py-3 text-secondary small">Error loading questions.</div>`;
            return;
        }

        const data = await res.json();
        const questions = data.questions;

        const dlFormatted = formatLocalDateTime(data.deadlineString);

        let settingsPanelHTML = `
            <div class="glass-panel mb-4 p-3 border rounded bg-light shadow-sm" style="border-color: rgba(99, 102, 241, 0.25) !important;">
                <h6 class="fw-bold text-dark mb-3 d-flex align-items-center gap-1" style="font-family: var(--font-heading);">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 8v4l3 3"></path></svg>
                    Quiz-Level Parameters & Access Configuration
                </h6>
                <div class="row g-3">
                    <div class="col-md-4">
                        <label class="small text-secondary fw-semibold">📅 Due Date (Deadline)</label>
                        <input type="datetime-local" class="form-control form-control-sm text-dark bg-white" id="edit-quiz-deadline" value="${dlFormatted}">
                    </div>
                    <div class="col-md-3">
                        <label class="small text-secondary fw-semibold">⏱ Time Limit (Minutes)</label>
                        <input type="number" class="form-control form-control-sm text-dark bg-white" id="edit-quiz-timelimit" value="${data.timeLimitMinutes ?? 40}">
                    </div>
                    <div class="col-md-5 d-flex align-items-end gap-3 flex-wrap">
                        <div class="form-check form-switch mb-1">
                            <input class="form-check-input" type="checkbox" id="edit-quiz-isopen" ${data.isQuizOpen ? 'checked' : ''}>
                            <label class="form-check-label small fw-semibold text-secondary" for="edit-quiz-isopen">Quiz Open</label>
                        </div>
                        <div class="form-check form-switch mb-1">
                            <input class="form-check-input" type="checkbox" id="edit-quiz-isforumopen" ${data.isForumOpen ? 'checked' : ''}>
                            <label class="form-check-label small fw-semibold text-secondary" for="edit-quiz-isforumopen">Forum Open</label>
                        </div>
                        <button class="btn btn-sm btn-dark-custom px-3 ms-auto" onclick="saveActiveQuizSettings()">
                            Save Settings
                        </button>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = settingsPanelHTML;

        if (!questions || questions.length === 0) {
            container.innerHTML += `<div class="text-center py-3 text-secondary small border rounded p-4 bg-white">No questions found for this quiz.</div>`;
            return;
        }

        questions.forEach((q, idx) => {
            const card = document.createElement('div');
            card.className = "p-3 border rounded bg-white mb-3 shadow-sm";
            card.style.borderColor = "var(--border-color)";

            let cardHTML = `
                <div class="d-flex justify-content-between align-items-center mb-2 border-bottom pb-2">
                    <h6 class="small fw-bold text-dark mb-0">Question #${idx + 1} (${q.type})</h6>
                    <span class="badge bg-secondary font-monospace" style="font-size: 10px;">ID: ${q.id}</span>
                </div>
                <div class="row g-2 mb-2">
                    <div class="col-md-8">
                        <label class="small text-secondary fw-semibold">Prompt / Question Content</label>
                        <input type="text" class="form-control form-control-sm text-dark bg-white" id="edit-q-prompt-${q.id}" value="${q.prompt || ''}">
                    </div>
                    <div class="col-md-4">
                        <label class="small text-secondary fw-semibold">Topic</label>
                        <input type="text" class="form-control form-control-sm text-dark bg-white" id="edit-q-topic-${q.id}" value="${q.topic || 'General'}">
                    </div>
                </div>
                <div class="row g-2 mb-2">
                    <div class="col-md-6">
                        <label class="small text-secondary fw-semibold">Question Score Weight</label>
                        <input type="number" step="0.1" class="form-control form-control-sm text-dark bg-white" id="edit-q-score-${q.id}" value="${q.maxScore}">
                    </div>`;

            if (q.type === 'MCQ') {
                const optA = q.options && q.options[0] ? q.options[0].replace(/^A\.\s*/, '') : '';
                const optB = q.options && q.options[1] ? q.options[1].replace(/^B\.\s*/, '') : '';
                const optC = q.options && q.options[2] ? q.options[2].replace(/^C\.\s*/, '') : '';
                const optD = q.options && q.options[3] ? q.options[3].replace(/^D\.\s*/, '') : '';

                cardHTML += `
                    <div class="col-md-6">
                        <label class="small text-secondary fw-semibold">Correct Option Key</label>
                        <select class="form-select form-select-sm text-dark bg-white" id="edit-q-key-${q.id}">
                            <option value="A" ${q.correctKey === 'A' ? 'selected' : ''}>Option A</option>
                            <option value="B" ${q.correctKey === 'B' ? 'selected' : ''}>Option B</option>
                            <option value="C" ${q.correctKey === 'C' ? 'selected' : ''}>Option C</option>
                            <option value="D" ${q.correctKey === 'D' ? 'selected' : ''}>Option D</option>
                        </select>
                    </div>
                </div>
                <div class="mb-3">
                    <label class="small text-secondary fw-semibold d-block mb-1">Answer Options Content</label>
                    <div class="row g-2">
                        <div class="col-md-6">
                            <input type="text" class="form-control form-control-sm text-dark bg-white" id="edit-q-optA-${q.id}" value="${optA}" placeholder="Option A text">
                        </div>
                        <div class="col-md-6">
                            <input type="text" class="form-control form-control-sm text-dark bg-white" id="edit-q-optB-${q.id}" value="${optB}" placeholder="Option B text">
                        </div>
                        <div class="col-md-6">
                            <input type="text" class="form-control form-control-sm text-dark bg-white" id="edit-q-optC-${q.id}" value="${optC}" placeholder="Option C text">
                        </div>
                        <div class="col-md-6">
                            <input type="text" class="form-control form-control-sm text-dark bg-white" id="edit-q-optD-${q.id}" value="${optD}" placeholder="Option D text">
                        </div>
                    </div>
                </div>`;
            } else {
                cardHTML += `
                    <div class="col-md-6">
                        <!-- Spacer -->
                    </div>
                </div>
                <div class="mb-3">
                    <label class="small text-secondary fw-semibold">Marking Guidelines (Quiz Note / Ideas to Check)</label>
                    <textarea class="form-control form-control-sm text-dark bg-white" id="edit-q-guide-${q.id}" rows="2" placeholder="e.g. Ensure they check boundary cases, use clean loops...">${q.markingGuide || ''}</textarea>
                </div>`;
            }

            cardHTML += `
                <div class="text-end">
                    <button class="btn btn-sm btn-dark-custom px-3 py-1 fw-semibold" onclick="saveQuestionChanges(${q.id}, '${q.type}')">Save Changes</button>
                </div>`;

            card.innerHTML = cardHTML;
            container.appendChild(card);
        });
    } catch (err) {
        container.innerHTML = `<div class="alert-custom alert-custom-warning small">Error rendering question console: ${err.message}</div>`;
    }
}

async function saveQuestionChanges(qId, type) {
    const prompt = document.getElementById(`edit-q-prompt-${qId}`).value.trim();
    const topic = document.getElementById(`edit-q-topic-${qId}`).value.trim() || "General";
    const maxScore = parseFloat(document.getElementById(`edit-q-score-${qId}`).value) || 0.0;

    if (!prompt) {
        return alert("Question prompt is required.");
    }

    let options = null;
    let correctKey = "";
    let markingGuide = null;

    if (type === 'MCQ') {
        const optA = document.getElementById(`edit-q-optA-${qId}`).value.trim();
        const optB = document.getElementById(`edit-q-optB-${qId}`).value.trim();
        const optC = document.getElementById(`edit-q-optC-${qId}`).value.trim();
        const optD = document.getElementById(`edit-q-optD-${qId}`).value.trim();
        correctKey = document.getElementById(`edit-q-key-${qId}`).value;

        if (!optA || !optB || !optC || !optD) {
            return alert("All option fields A, B, C, D are required.");
        }
        options = [`A. ${optA}`, `B. ${optB}`, `C. ${optC}`, `D. ${optD}`];
    } else {
        markingGuide = document.getElementById(`edit-q-guide-${qId}`).value.trim();
        correctKey = "Custom criteria validation";
    }

    try {
        const payload = {
            id: qId,
            prompt: prompt,
            topic: topic,
            maxScore: maxScore,
            correctKey: correctKey,
            options: options,
            markingGuide: markingGuide
        };

        const res = await fetch(`${API_BASE}/questions/update-question`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Failed to update question.");

        alert("✔ Question successfully updated in database! " + (type === 'MCQ' ? "Classroom MCQ answers re-graded." : ""));

        // Refresh active questions list view
        await renderViewQuizQuestions();
    } catch (err) {
        alert("Error saving edits: " + err.message);
    }
}

// ================= INSTRUCTOR DASHBOARD FLOW =================

async function switchTeacherTab(tab) {
    document.querySelectorAll('.teacher-tab-content').forEach(c => c.classList.add('d-none'));
    document.querySelectorAll('#teacherTabs .nav-link-custom').forEach(l => l.classList.remove('active'));

    document.getElementById(`teacher-tab-${tab}`).classList.remove('d-none');
    document.getElementById(`tab-btn-${tab}`).classList.add('active');

    if (tab === 'analytics') {
        await loadQuizzesSidebar();

        if (state.selectedQuizTitle) {
            const placeholder = document.getElementById('teacherDashboardEmptyPlaceholder');
            if (placeholder) placeholder.classList.add('d-none');
            const createContainer = document.getElementById('quizCreateViewContainer');
            if (createContainer) createContainer.classList.add('d-none');
            const selectedContainer = document.getElementById('quizSelectedViewContainer');
            if (selectedContainer) selectedContainer.classList.remove('d-none');

            const headerTitle = document.getElementById('activeQuizTitleHeader');
            if (headerTitle) headerTitle.innerText = state.selectedQuizTitle;

            await switchQuizSubTab(state.activeQuizSubTab || 'view');
        } else {
            const placeholder = document.getElementById('teacherDashboardEmptyPlaceholder');
            if (placeholder) placeholder.classList.remove('d-none');
            const createContainer = document.getElementById('quizCreateViewContainer');
            if (createContainer) createContainer.classList.add('d-none');
            const selectedContainer = document.getElementById('quizSelectedViewContainer');
            if (selectedContainer) selectedContainer.classList.add('d-none');
        }
    }
    if (tab === 'forum') {
        initializeInstructorDashboardForum();
    }
}

async function loadInstructorAnalytics() {
    try {
        const titleQuery = state.selectedQuizTitle ? `?quizTitle=${encodeURIComponent(state.selectedQuizTitle)}` : "";
        const res = await fetch(`${API_BASE}/instructor/analytics${titleQuery}`);
        if (!res.ok) throw new Error("Failed to load analytics.");

        const data = await res.json();
        const titleEl = document.getElementById('analyticsTaskTitle');
        if (titleEl) titleEl.innerText = data.activeTaskTitle;

        document.getElementById('analyticsSubmissionCount').innerText = `${data.totalSubmissionsCount} / 60 Students`;

        const failBadge = document.getElementById('analyticsFailureRate');
        failBadge.innerText = `${data.failureRatePercentage}% Failure Rate`;
        if (data.failureRatePercentage > 40) {
            failBadge.className = "badge-custom badge-custom-rose";
        } else {
            failBadge.className = "badge-custom badge-custom-emerald";
        }

        document.getElementById('classAvgLabelField').innerText = `Class Avg: ${data.classAverageScore} / ${state.totalScore}`;

        // Fetch active questions for the selected quiz to update state.questions
        const resQ = await fetch(`${API_BASE}/questions${titleQuery}`);
        if (resQ.ok) {
            const dataQ = await resQ.json();
            state.questions = dataQ.questions;
        }

        const inlineEditSec = document.getElementById('instructorPerQuestionInlineEditSection');
        if (inlineEditSec) {
            if (data.totalSubmissionsCount > 0) {
                renderInlineQuestionEditSection();
            } else {
                inlineEditSec.style.display = "none";
            }
        }

        await loadQuestionDiagnostics();
    } catch (err) {
        console.error(err);
    }
}

async function saveActiveQuizSettings() {
    const deadlineRaw = document.getElementById('edit-quiz-deadline').value;
    const deadlineVal = deadlineRaw ? convertReginaToUtcIso(deadlineRaw) : null;
    const timeLimitVal = parseInt(document.getElementById('edit-quiz-timelimit').value) || 40;
    const isQuizOpenVal = document.getElementById('edit-quiz-isopen').checked;
    const isForumOpenVal = document.getElementById('edit-quiz-isforumopen').checked;

    try {
        const payload = {
            title: state.selectedQuizTitle || state.activeTaskTitle,
            timeLimitMinutes: timeLimitVal,
            isQuizOpen: isQuizOpenVal,
            isForumOpen: isForumOpenVal,
            deadlineString: deadlineVal
        };

        const res = await fetch(`${API_BASE}/questions/update-settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Failed to save quiz settings.");

        alert("✔ Quiz settings updated successfully.");
        await switchQuizSubTab('view');
    } catch (err) {
        alert(err.message);
    }
}

async function loadQuestionDiagnostics() {
    
    const container = document.getElementById('analyticsQuestionDiagnosticsContainer');
    if (!container) return;

    try {
        const titleQuery = state.selectedQuizTitle ? `&quizTitle=${encodeURIComponent(state.selectedQuizTitle)}` : "";
        const res = await fetch(`${API_BASE}/instructor/roster?subTab=all${titleQuery}`);
        if (!res.ok) throw new Error("Failed to load analytics.");
        const submissions = await res.json();

        if (submissions.length === 0) {
            container.innerHTML = `<div class="text-center py-3 text-secondary small">No student submissions available for diagnostics.</div>`;
            return;
        }

        let highCount = 0;
        let avgCount = 0;
        let lowCount = 0;
        let flaggedHTML = "";
        let helpHTML = "";

        const totalScoreLimit = state.totalScore || 10.0;

        submissions.forEach(sub => {
            const score = parseFloat(sub.finalScore) || 0;
            const diff = sub.surveyDifficulty || "Medium";

            
            if (score >= 0.8 * totalScoreLimit) {
                highCount++;
            } else if (score >= 0.5 * totalScoreLimit) {
                avgCount++;
            } else {
                lowCount++;
            }

           
            if (diff === "Hard" && score >= 0.8 * totalScoreLimit) {
                flaggedHTML += `
                    <li class="mb-2">
                        <strong>${sub.studentName} (${sub.studentId})</strong> scored <strong>${score} / ${totalScoreLimit}</strong> pts but rated difficulty as <strong>"Hard"</strong>.
                        <br><span class="text-secondary italic">Note: "${sub.surveyPainPoint || "No comments."}"</span>
                    </li>`;
            }

            
            if (score < 0.5 * totalScoreLimit) {
                helpHTML += `
                    <li class="mb-2">
                        <strong>${sub.studentName} (${sub.studentId})</strong> scored <strong>${score} / ${totalScoreLimit}</strong> pts.
                        <br><span class="text-secondary italic">Difficulty: "${diff}" | Note: "${sub.surveyPainPoint || "No comments."}"</span>
                    </li>`;
            }
        });

        const totalSubs = submissions.length;
        const highPct = Math.round((highCount / totalSubs) * 100);
        const avgPct = Math.round((avgCount / totalSubs) * 100);
        const lowPct = Math.round((lowCount / totalSubs) * 100);

        let html = `
            <div class="row g-3 mb-4">
                <div class="col-md-4">
                    <div class="p-3 border rounded bg-light text-center">
                        <span class="d-block text-secondary small">High Scores (>=80%)</span>
                        <strong class="text-emerald fs-4">${highCount}</strong> <span class="text-secondary small">(${highPct}%)</span>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="p-3 border rounded bg-light text-center">
                        <span class="d-block text-secondary small">Average Scores (50%-79%)</span>
                        <strong class="text-cyan fs-4">${avgCount}</strong> <span class="text-secondary small">(${avgPct}%)</span>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="p-3 border rounded bg-light text-center">
                        <span class="d-block text-secondary small">Low Scores (<50%)</span>
                        <strong class="text-rose fs-4">${lowCount}</strong> <span class="text-secondary small">(${lowPct}%)</span>
                    </div>
                </div>
            </div>`;

        if (flaggedHTML !== "") {
            html += `
                <div class="p-3 border border-danger rounded mb-3" style="background-color: rgba(239, 68, 68, 0.05);">
                    <h6 class="text-danger fw-bold small mb-2">⚠️ Pacing Metric Anomaly Warnings (Hard / High Score):</h6>
                    <ul class="mb-0 ps-3 text-danger small">${flaggedHTML}</ul>
                </div>`;
        } else {
            html += `
                <div class="p-3 border border-success rounded mb-3 text-success small d-flex align-items-center gap-2" style="background-color: rgba(16, 185, 129, 0.05);">
                    <span>✔ No student survey discrepancies identified.</span>
                </div>`;
        }

        if (helpHTML !== "") {
            html += `
                <div class="p-3 border border-warning rounded mb-3" style="background-color: rgba(245, 158, 11, 0.05);">
                    <h6 class="text-warning fw-bold small mb-2">⚠️ Students Needing Help (Score < 50%):</h6>
                    <ul class="mb-0 ps-3 text-warning small">${helpHTML}</ul>
                </div>`;
        }

        container.innerHTML = html;
    } catch (err) {
        container.innerHTML = `<div class="alert-custom alert-custom-warning small">Error loading analytics: ${err.message}</div>`;
    }
}
async function renderInlineQuestionEditSection() {
    const section = document.getElementById('instructorPerQuestionInlineEditSection');
    const container = document.getElementById('inlineQuestionEditContainer');
    if (!section || !container) return;

    try {
        const res = await fetch(`${API_BASE}/questions`);
        if (!res.ok) return;
        const data = await res.json();

        section.style.display = "block";
        container.innerHTML = "";

        data.questions.forEach(q => {
            if (q.type === "MCQ") {
                container.innerHTML = `
                    <div class="p-2 border rounded bg-dark-subtle d-flex align-items-center gap-2 small" style="border-color: var(--border-color) !important;">
                        <strong>Question ${q.id} (MCQ):</strong> Modify solution key target to:
                        <select class="form-select form-select-sm" style="width:140px; display:inline-block;" onchange="inlineModifyAnswerKey(${q.id}, this.value)">
                            <option value="B" ${q.correctKey === 'B' ? 'selected' : ''}>Option B</option>
                            <option value="A" ${q.correctKey === 'A' ? 'selected' : ''}>Option A</option>
                            <option value="C" ${q.correctKey === 'C' ? 'selected' : ''}>Option C</option>
                            <option value="D" ${q.correctKey === 'D' ? 'selected' : ''}>Option D</option>
                        </select>
                        <span class="text-secondary small italic">Changing key triggers automated classroom re-grading.</span>
                    </div>`;
            }
        });
    } catch (err) {
        console.error(err);
    }
}

async function inlineModifyAnswerKey(qId, val) {
    try {
        const payload = { questionId: qId, correctKey: val };
        const res = await fetch(`${API_BASE}/instructor/update-answer-key`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Could not update key.");

        alert(`Answer key successfully mutated in database. All student scores re-calculated.`);
        loadInstructorAnalytics();
        switchRosterSubTab(state.activeRosterSubTab);
    } catch (err) {
        alert(err.message);
    }
}

function switchRosterSubTab(subTab) {
    // TODO: Team Member 3 - Mutate active sub-tab view contexts and initiate roster table content refresh.
    state.activeRosterSubTab = subTab;
    document.querySelectorAll('.sub-tab-link').forEach(l => l.classList.remove('active'));

    const btn = document.getElementById(`sub-btn-${subTab}`);
    if (btn) btn.classList.add('active');

    const heading = document.getElementById('rosterBlockHeadingTitle');
    const headerColumn = document.getElementById('dynamicRosterNoteColumnHeader');

    if (subTab === "pending") {
        if (heading) heading.innerText = "Student Submissions";
        if (headerColumn) headerColumn.innerText = "Feedback";
    } else if (subTab === "graded") {
        if (heading) heading.innerText = "Graded Submissions";
        if (headerColumn) headerColumn.innerText = "Difficulty";
    } else if (subTab === "dispute") {
        if (heading) heading.innerText = "Disputed Grades";
        if (headerColumn) headerColumn.innerText = "Reason";
    }

    renderMultiStudentRosterTable();
}
async function renderMultiStudentRosterTable() {
    // TODO: Team Member 3 - Retrieve student roster summaries filtered by tab parameters and render table rows.
    const tbody = document.getElementById('multiStudentRosterTableBody');
    if (!tbody) return;
    tbody.innerHTML = "";

    try {
        const titleQuery = state.selectedQuizTitle ? `&quizTitle=${encodeURIComponent(state.selectedQuizTitle)}` : "";
        const res = await fetch(`${API_BASE}/instructor/roster?subTab=${state.activeRosterSubTab}${titleQuery}`);
        if (!res.ok) throw new Error("Failed to load roster.");
        const roster = await res.json();

        // Cập nhật số lượng thông báo Dispute Ticket Badge
        const resTix = await fetch(`${API_BASE}/instructor/roster?subTab=dispute${titleQuery}`);
        if (resTix.ok) {
            const disputeList = await resTix.json();
            const badge = document.getElementById('subTabTicketBadgeCount');
            if (badge) {
                if (disputeList.length > 0) {
                    badge.style.display = "inline-block";
                    badge.innerText = disputeList.length;
                } else {
                    badge.style.display = "none";
                }
            }
        }

        if (roster.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-secondary p-4 small">No submissions in this list.</td></tr>`;
            return;
        }

        roster.forEach(student => {
            let btnText = "Grade";
            let btnClass = "btn-dark-custom";

            if (state.activeRosterSubTab === "graded") {
                btnText = "Review";
                btnClass = "btn-outline-custom";
            } else if (state.activeRosterSubTab === "dispute") {
                btnText = "Audit Dispute";
                btnClass = "btn-dark-custom bg-danger border-danger";
            }

            const titleParam = state.selectedQuizTitle ? `&quizTitle=${encodeURIComponent(state.selectedQuizTitle)}` : "";
            const actionBtnMarkup = `<button class="btn btn-sm ${btnClass} py-1 px-3" style="font-size:12px;" onclick="window.location.href='/Instructor/Grading?studentId=${student.studentId}${titleParam}'">${btnText}</button>`;
            const displayScoreNode = student.status === 'Graded' ? `${student.finalScore} pts` : '--';

            tbody.innerHTML += `
                <tr>
                    <td><strong>${student.studentName}</strong></td>
                    <td class="text-secondary font-monospace" style="font-size:12px;">Submission_${student.studentId}</td>
                    <td class="text-center text-secondary small italic">${student.surveyPainPoint || 'No notes.'}</td>
                    <td class="text-center fw-bold font-monospace text-cyan small">${displayScoreNode}</td>
                    <td>${actionBtnMarkup}</td>
                </tr>`;
        });
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger p-4 small">Error loading roster. Check console.</td></tr>`;
    }
}



// Assignment Factory creator dynamic views
let customQuestionCounter = 0;

function addCustomQuestionField(type) {
    const container = document.getElementById('custom-questions-list-container');
    if (!container) return;

    customQuestionCounter++;
    const qId = customQuestionCounter;

    const card = document.createElement('div');
    card.className = "p-3 border rounded custom-question-card bg-light mb-2";
    card.id = `custom-question-node-${qId}`;
    card.setAttribute('data-type', type);

    let cardHTML = `
        <div class="d-flex justify-content-between align-items-center mb-2 border-bottom pb-2">
            <h6 class="small fw-bold text-dark mb-0">Question #${container.children.length + 1} (${type})</h6>
            <button class="btn btn-sm btn-link text-danger p-0" type="button" onclick="removeCustomQuestionField(${qId})">Remove</button>
        </div>
        <div class="mb-2">
            <label class="small text-secondary">Question Weight (Score Value)</label>
            <input type="number" step="0.1" class="form-control form-control-sm custom-q-score" value="5.0" min="0" required>
        </div>
        <div class="mb-2">
            <label class="small text-secondary">Topic (e.g. Arrays, Recursion, Loops)</label>
            <input type="text" class="form-control form-control-sm custom-q-topic" placeholder="Type topic name (optional)...">
        </div>`;

    if (state.quizMode !== "PDF") {
        cardHTML += `
            <div class="mb-2">
                <label class="small text-secondary">Prompt / Question Content</label>
                <input type="text" class="form-control form-control-sm custom-q-prompt" placeholder="Type prompt..." required>
            </div>`;
    }

    if (type === 'MCQ') {
        if (state.quizMode !== "PDF") {
            cardHTML += `
                <div class="mb-3">
                    <label class="small text-secondary fw-semibold">MCQ Answer Options</label>
                    <div class="row g-2">
                        <div class="col-md-6">
                            <div class="input-group input-group-sm">
                                <span class="input-group-text font-monospace bg-light border-end-0">A</span>
                                <input type="text" class="form-control custom-q-optA" placeholder="Option A text..." required>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="input-group input-group-sm">
                                <span class="input-group-text font-monospace bg-light border-end-0">B</span>
                                <input type="text" class="form-control custom-q-optB" placeholder="Option B text..." required>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="input-group input-group-sm">
                                <span class="input-group-text font-monospace bg-light border-end-0">C</span>
                                <input type="text" class="form-control custom-q-optC" placeholder="Option C text..." required>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="input-group input-group-sm">
                                <span class="input-group-text font-monospace bg-light border-end-0">D</span>
                                <input type="text" class="form-control custom-q-optD" placeholder="Option D text..." required>
                            </div>
                        </div>
                    </div>
                </div>`;
        }
        cardHTML += `
            <div class="mb-2">
                <label class="small text-secondary">Correct Key</label>
                <select class="form-select form-select-sm custom-q-key" style="width: 120px;">
                    <option value="A">Option A</option>
                    <option value="B">Option B</option>
                    <option value="C">Option C</option>
                    <option value="D">Option D</option>
                </select>
            </div>`;
    }

    card.innerHTML = cardHTML;
    container.appendChild(card);
    updateQuestionCardNumbers();
}

function removeCustomQuestionField(qId) {
    const card = document.getElementById(`custom-question-node-${qId}`);
    if (card) {
        card.remove();
        updateQuestionCardNumbers();
    }
}

function updateQuestionCardNumbers() {
    const container = document.getElementById('custom-questions-list-container');
    if (!container) return;
    Array.from(container.children).forEach((card, idx) => {
        const title = card.querySelector('h6');
        const type = card.getAttribute('data-type');
        if (title) {
            title.innerText = `Question #${idx + 1} (${type})`;
        }
    });
}

function clearUploadedPdfField() {
    state.pdfBase64 = null;
    const pdfInput = document.getElementById('inputQuizPdf');
    if (pdfInput) pdfInput.value = "";
    const statusLabel = document.getElementById('quizPdfStatusLabel');
    if (statusLabel) {
        statusLabel.innerText = "No PDF document attached.";
    }
}

function harvestBuilderQuestions() {
    const container = document.getElementById('custom-questions-list-container');
    if (!container) return [];
    const harvested = [];
    Array.from(container.children).forEach(card => {
        const type = card.getAttribute('data-type');

        const topicInput = card.querySelector('.custom-q-topic');
        const promptInput = card.querySelector('.custom-q-prompt');
        const scoreInput = card.querySelector('.custom-q-score');
        const optAInput = card.querySelector('.custom-q-optA');
        const optBInput = card.querySelector('.custom-q-optB');
        const optCInput = card.querySelector('.custom-q-optC');
        const optDInput = card.querySelector('.custom-q-optD');
        const keyInput = card.querySelector('.custom-q-key');

        const topic = topicInput ? topicInput.value.trim() || "General" : "General";
        const prompt = promptInput ? promptInput.value.trim() : "";
        const maxScore = scoreInput ? parseFloat(scoreInput.value) || 0.0 : 0.0;
        const optA = optAInput ? optAInput.value.trim() : "";
        const optB = optBInput ? optBInput.value.trim() : "";
        const optC = optCInput ? optCInput.value.trim() : "";
        const optD = optDInput ? optDInput.value.trim() : "";
        const key = keyInput ? keyInput.value : "A";

        harvested.push({
            type: type,
            topic: topic,
            prompt: prompt,
            options: type === 'MCQ' ? [`A. ${optA}`, `B. ${optB}`, `C. ${optC}`, `D. ${optD}`] : null,
            correctKey: key,
            maxScore: maxScore
        });
    });
    return harvested;
}

function toggleQuizModeLayout() {
    const selectEl = document.getElementById('inputQuizMode');
    if (!selectEl) return;

    state.quizMode = selectEl.value;

    const wrapper = document.getElementById('pdfUploadWrapper');
    if (wrapper) {
        if (state.quizMode === "PDF") {
            wrapper.classList.remove('d-none');
        } else {
            wrapper.classList.add('d-none');
        }
    }

    // Refresh builder fields
    const currentQs = harvestBuilderQuestions();
    state.questions = currentQs;
    populateQuestionBuilderFromState();
}

function populateQuestionBuilderFromState() {
    const container = document.getElementById('custom-questions-list-container');
    if (!container) return;
    container.innerHTML = "";
    customQuestionCounter = 0;

    if (state.questions && state.questions.length > 0) {
        state.questions.forEach(q => {
            customQuestionCounter++;
            const qId = customQuestionCounter;

            const card = document.createElement('div');
            card.className = "p-3 border rounded custom-question-card bg-light mb-2";
            card.id = `custom-question-node-${qId}`;
            card.setAttribute('data-type', q.type);

            let cardHTML = `
                <div class="d-flex justify-content-between align-items-center mb-2 border-bottom pb-2">
                    <h6 class="small fw-bold text-dark mb-0">Question #${container.children.length + 1} (${q.type})</h6>
                    <button class="btn btn-sm btn-link text-danger p-0" type="button" onclick="removeCustomQuestionField(${qId})">Remove</button>
                </div>
                <div class="mb-2">
                    <label class="small text-secondary">Question Weight (Score Value)</label>
                    <input type="number" step="0.1" class="form-control form-control-sm custom-q-score" value="${q.maxScore || '5.0'}" min="0" required>
                </div>
                <div class="mb-2">
                    <label class="small text-secondary">Topic (e.g. Arrays, Recursion, Loops)</label>
                    <input type="text" class="form-control form-control-sm custom-q-topic" value="${q.topic || ''}" placeholder="Type topic name (optional)...">
                </div>`;

            if (state.quizMode !== "PDF") {
                cardHTML += `
                    <div class="mb-2">
                        <label class="small text-secondary">Prompt / Question Content</label>
                        <input type="text" class="form-control form-control-sm custom-q-prompt" value="${q.prompt || ''}" placeholder="Type prompt..." required>
                    </div>`;
            }

            if (q.type === 'MCQ') {
                if (state.quizMode !== "PDF") {
                    const optA = q.options && q.options[0] ? q.options[0].replace(/^A\.\s*/, '') : '';
                    const optB = q.options && q.options[1] ? q.options[1].replace(/^B\.\s*/, '') : '';
                    const optC = q.options && q.options[2] ? q.options[2].replace(/^C\.\s*/, '') : '';
                    const optD = q.options && q.options[3] ? q.options[3].replace(/^D\.\s*/, '') : '';

                    cardHTML += `
                        <div class="mb-3">
                            <label class="small text-secondary fw-semibold">MCQ Answer Options</label>
                            <div class="row g-2">
                                <div class="col-md-6">
                                    <div class="input-group input-group-sm">
                                        <span class="input-group-text font-monospace bg-light border-end-0">A</span>
                                        <input type="text" class="form-control custom-q-optA" value="${optA}" placeholder="Option A text..." required>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="input-group input-group-sm">
                                        <span class="input-group-text font-monospace bg-light border-end-0">B</span>
                                        <input type="text" class="form-control custom-q-optB" value="${optB}" placeholder="Option B text..." required>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="input-group input-group-sm">
                                        <span class="input-group-text font-monospace bg-light border-end-0">C</span>
                                        <input type="text" class="form-control custom-q-optC" value="${optC}" placeholder="Option C text..." required>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="input-group input-group-sm">
                                        <span class="input-group-text font-monospace bg-light border-end-0">D</span>
                                        <input type="text" class="form-control custom-q-optD" value="${optD}" placeholder="Option D text..." required>
                                    </div>
                                </div>
                            </div>
                        </div>`;
                }
                cardHTML += `
                    <div class="mb-2">
                        <label class="small text-secondary">Correct Key</label>
                        <select class="form-select form-select-sm custom-q-key" style="width: 120px;">
                            <option value="A" ${q.correctKey === 'A' ? 'selected' : ''}>Option A</option>
                            <option value="B" ${q.correctKey === 'B' ? 'selected' : ''}>Option B</option>
                            <option value="C" ${q.correctKey === 'C' ? 'selected' : ''}>Option C</option>
                            <option value="D" ${q.correctKey === 'D' ? 'selected' : ''}>Option D</option>
                        </select>
                    </div>`;
            }

            card.innerHTML = cardHTML;
            container.appendChild(card);
        });
        updateQuestionCardNumbers();
    } else {
        addCustomQuestionField('MCQ');
    }
}

async function instructorPublishTask() {
    const titleVal = document.getElementById('inputTaskTitle').value;
    if (!titleVal) return alert("Assignment title is required.");

    const totalScoreVal = parseFloat(document.getElementById('inputQuizTotalScore').value);
    if (isNaN(totalScoreVal) || totalScoreVal <= 0) {
        return alert("Total Score must be a positive number.");
    }

    if (state.quizMode === "PDF" && !state.pdfBase64) {
        return alert("A PDF document must be uploaded in PDF Exam mode.");
    }

    let questionsPayload = [];
    const container = document.getElementById('custom-questions-list-container');
    if (!container || container.children.length === 0) {
        return alert("Please add at least one question to publish.");
    }

    let hasError = false;
    let sumWeights = 0.0;

    Array.from(container.children).forEach((card, idx) => {
        const type = card.getAttribute('data-type');
        const topic = card.querySelector('.custom-q-topic').value.trim() || "General";
        const scoreInput = card.querySelector('.custom-q-score');
        const maxScore = scoreInput ? parseFloat(scoreInput.value) || 0.0 : 0.0;
        sumWeights += maxScore;

        let prompt = "";

        if (state.quizMode === "PDF") {
            prompt = `Question #${idx + 1} (PDF Exam)`;
        } else {
            const promptInput = card.querySelector('.custom-q-prompt');
            prompt = promptInput ? promptInput.value.trim() : "";
        }

        if (!prompt) {
            hasError = true;
            return;
        }

        if (type === 'MCQ') {
            let optA = "Option A";
            let optB = "Option B";
            let optC = "Option C";
            let optD = "Option D";
            const key = card.querySelector('.custom-q-key').value;

            if (state.quizMode === "Manual") {
                optA = card.querySelector('.custom-q-optA').value.trim();
                optB = card.querySelector('.custom-q-optB').value.trim();
                optC = card.querySelector('.custom-q-optC').value.trim();
                optD = card.querySelector('.custom-q-optD').value.trim();

                if (!optA || !optB || !optC || !optD) {
                    hasError = true;
                    return;
                }
            }

            questionsPayload.push({
                type: "MCQ",
                topic: topic,
                prompt: prompt,
                options: [`A. ${optA}`, `B. ${optB}`, `C. ${optC}`, `D. ${optD}`],
                correctKey: key,
                maxScore: maxScore
            });
        } else {
            questionsPayload.push({
                type: "Essay",
                topic: topic,
                prompt: prompt,
                correctKey: "Custom criteria validation",
                maxScore: maxScore
            });
        }
    });

    if (hasError) {
        return alert("Please fill in all topic, prompt, and option fields for all questions.");
    }

    // Validate sum of weights equals Total Score
    // Use a small tolerance for floating point comparisons
    if (Math.abs(sumWeights - totalScoreVal) > 0.001) {
        return alert(`Validation Failure: The sum of question weights (${sumWeights.toFixed(1)}) must exactly equal the Total Score (${totalScoreVal.toFixed(1)}).`);
    }

    const timeLimitVal = parseInt(document.getElementById('inputQuizTimeLimit').value) || 40;
    const deadlineRaw = document.getElementById('inputQuizDeadline').value;
    const deadlineVal = deadlineRaw ? convertReginaToUtcIso(deadlineRaw) : null;
    const isQuizOpenVal = document.getElementById('inputIsQuizOpen').checked;
    const isForumOpenVal = document.getElementById('inputIsForumOpen').checked;

    try {
        const payload = {
            title: titleVal,
            questions: questionsPayload,
            timeLimitMinutes: timeLimitVal,
            isQuizOpen: isQuizOpenVal,
            isForumOpen: isForumOpenVal,
            deadlineString: deadlineVal,
            pdfBase64: state.pdfBase64,
            quizMode: state.quizMode,
            totalScore: totalScoreVal
        };

        const res = await fetch(`${API_BASE}/questions/publish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Failed to publish assessment.");

        alert("✔ New assessment successfully generated and active configurations updated!");

        // Reload questions config in state
        const resQ = await fetch(`${API_BASE}/questions`);
        if (resQ.ok) {
            const dataQ = await resQ.json();
            state.activeTaskTitle = dataQ.title;
            state.questions = dataQ.questions;
            state.timeLimitMinutes = dataQ.timeLimitMinutes ?? 40;
            state.isQuizOpen = dataQ.isQuizOpen ?? true;
            state.isForumOpen = dataQ.isForumOpen ?? true;
            state.deadlineString = dataQ.deadlineString ?? null;
            state.pdfBase64 = dataQ.pdfBase64 ?? null;
            state.quizMode = dataQ.quizMode ?? "Manual";
            state.totalScore = dataQ.totalScore ?? 10.0;
        }

        switchTeacherTab('analytics');
    } catch (err) {
        alert(err.message);
    }
}



// ================= INSTRUCTOR GRADING DESK FLOW =================

async function routeTargetStudentToEvaluationDesk(studentId) {
    state.activeGradingStudentID = studentId;

    try {
        const titleQuery = state.selectedQuizTitle ? `?quizTitle=${encodeURIComponent(state.selectedQuizTitle)}` : "";
        const resQ = await fetch(`${API_BASE}/questions${titleQuery}`);
        if (resQ.ok) {
            const dataQ = await resQ.json();
            state.pdfBase64 = dataQ.pdfBase64 ?? null;
            state.quizMode = dataQ.quizMode ?? "Manual";
            state.totalScore = dataQ.totalScore ?? 10.0;
        }

        const res = await fetch(`${API_BASE}/student/mistake-bank/${studentId}${titleQuery}`);
        if (!res.ok) throw new Error("Could not fetch submission details.");
        const studentObj = await res.json();

        const isDisputeMode = studentObj.disputeStatus === "PendingReview" || studentObj.disputeStatus.startsWith("Resolved");

        const layoutArea = document.getElementById('gradingWorkspaceLayoutArea');
        if (layoutArea && isDisputeMode) {
            layoutArea.innerHTML = `
                <div class="col-lg-7" style="max-height: 750px; overflow-y: auto; padding-right: 10px;">
                    <!-- Crosscheck Validation Alert Box -->
                    <div id="surveyAuditCrossCheckModule" class="mb-4"></div>
                    
                    <!-- Student Submission outputs -->
                    <div class="glass-panel mb-4" style="border-color: var(--border-color) !important;">
                        <h5 class="fw-bold border-bottom border-secondary pb-2 mb-4 d-flex justify-content-between align-items-center" style="font-family: var(--font-heading);">
                            <span>Student Submission Details</span>
                            <span class="text-indigo font-monospace" style="font-size: 15px;" id="liveGradingTotalScoreHeader">Final Score: ${studentObj.finalScore} / ${state.totalScore} pts</span>
                        </h5>
                        <div id="gradingQuestionsLoopContainer"></div>
                    </div>
                </div>
                <div class="col-lg-5">
                    <!-- Unified Private Dispute Chat Zone -->
                    <div class="glass-panel mb-4 border rounded shadow-sm" style="border-color: var(--border-color) !important;">
                        <h5 class="fw-bold border-bottom border-secondary pb-2 mb-3" style="font-family: var(--font-heading);">💬 Private Dispute Dialogue Room</h5>
                        <div class="chat-window shadow-sm">
                            <div class="chat-header">Discussion Thread with ${studentObj.studentName}</div>
                            <div class="p-3">
                                <div id="instructorUnifiedDisputeChatStream" class="chat-message-stream mb-3" style="height: 320px; overflow-y: auto;">
                                    <!-- Private chat comments -->
                                </div>
                                ${studentObj.disputeStatus === 'PendingReview' ? `
                                <div class="input-group mb-3">
                                    <input type="text" id="inputInstructorUnifiedDisputeMessage" class="form-control" placeholder="Reply to student dispute query...">
                                    <button class="btn btn-dark-custom" onclick="sendInstructorUnifiedDisputeComment('${studentId}')">Send</button>
                                </div>` : `
                                <div class="alert-custom alert-custom-warning small text-center mb-3">
                                    🔒 This dialogue room is closed (Dispute resolved).
                                </div>`}
                            </div>
                        </div>
                    </div>
                    
                    <!-- Dispute Action Controller Panel -->
                    ${studentObj.disputeStatus === 'PendingReview' ? `
                    <div class="glass-panel p-3 border rounded shadow-sm" style="border-color: var(--accent-rose) !important; background: rgba(244, 63, 94, 0.02);">
                        <span class="small fw-bold text-rose d-block mb-3">🔧 SUBMISSION-LEVEL DISPUTE CONTROLLER:</span>
                        <div class="d-grid gap-2">
                            <button class="btn btn-success py-2.5 fw-bold" onclick="resolveInstructorSubmissionDispute('${studentId}', true)">🟢 APPROVE DISPUTE (Save overrides)</button>
                            <button class="btn btn-outline-custom border-danger text-rose py-2.5 fw-bold" onclick="resolveInstructorSubmissionDispute('${studentId}', false)">❌ REJECT DISPUTE (Sustain initial grades)</button>
                        </div>
                    </div>` : ''}
                </div>
            `;
        } else if (layoutArea && state.quizMode === "PDF") {
            const pdfSrc = state.pdfBase64.startsWith('data:') ? state.pdfBase64 : `data:application/pdf;base64,${state.pdfBase64}`;
            layoutArea.innerHTML = `
                <div class="col-lg-6">
                    <div class="glass-panel p-0 overflow-hidden" style="height: 700px; border-color: rgba(124, 58, 237, 0.25) !important;">
                        <iframe src="${pdfSrc}" width="100%" height="100%" style="border: none;"></iframe>
                    </div>
                </div>
                <div class="col-lg-6" style="max-height: 700px; overflow-y: auto; padding-right: 5px;">
                    <!-- Crosscheck Validation Alert Box -->
                    <div id="surveyAuditCrossCheckModule" class="mb-4"></div>
                    
                    <!-- Student Submission outputs -->
                    <div class="glass-panel mb-4" style="border-color: var(--border-color) !important;">
                        <h5 class="fw-bold border-bottom border-secondary pb-2 mb-4" style="font-family: var(--font-heading);">Submission Outputs Loop</h5>
                        <div id="gradingQuestionsLoopContainer"></div>
                        <div class="d-grid mt-4">
                            <button class="btn btn-dark-custom btn-lg py-2.5 fw-bold" onclick="instructorSubmitEvaluation()">
                                Save Grade
                            </button>
                        </div>
                    </div>
                    
                    <!-- Dispute private chat ticket zone -->
                    <div class="glass-panel" id="instructorDisputeTicketBlock" style="border-color: var(--border-color) !important;">
                        <h5 class="fw-bold border-bottom border-secondary pb-2 mb-3" style="font-family: var(--font-heading);">Dispute Chat</h5>
                        <div id="instructorPrivateTicketChatAreaZone"></div>
                    </div>
                </div>
            `;
        } else if (layoutArea) {
            layoutArea.innerHTML = `
                <div class="col-lg-9 mx-auto">
                    <!-- Crosscheck Validation Alert Box -->
                    <div id="surveyAuditCrossCheckModule" class="mb-4"></div>
                    
                    <!-- Student Submission outputs -->
                    <div class="glass-panel mb-4" style="border-color: var(--border-color) !important;">
                        <h5 class="fw-bold border-bottom border-secondary pb-2 mb-4" style="font-family: var(--font-heading);">Submission Answers</h5>
                        <div id="gradingQuestionsLoopContainer"></div>
                        <div class="d-grid mt-4">
                            <button class="btn btn-dark-custom btn-lg py-2.5 fw-bold" onclick="instructorSubmitEvaluation()">
                                Save Grade
                            </button>
                        </div>
                    </div>
                    
                    <!-- Dispute private chat ticket zone -->
                    <div class="glass-panel" id="instructorDisputeTicketBlock" style="border-color: var(--border-color) !important;">
                        <h5 class="fw-bold border-bottom border-secondary pb-2 mb-3" style="font-family: var(--font-heading);">Dispute Chat</h5>
                        <div id="instructorPrivateTicketChatAreaZone"></div>
                    </div>
                </div>
            `;
        }

        const auditBox = document.getElementById('surveyAuditCrossCheckModule');
        const mcqAnswerObj = studentObj.answers.find(a => a.questionType === "MCQ");
        const essayAnswerObj = studentObj.answers.find(a => a.questionType === "Essay");

        const hasPerfectMCQ = mcqAnswerObj ? mcqAnswerObj.isCorrect === true : false;

        if (hasPerfectMCQ && essayAnswerObj && essayAnswerObj.difficulty === "Hard" && studentObj.surveyPainPoint !== "Awaiting reflection survey...") {
            auditBox.innerHTML = `
                <div class="alert-custom alert-custom-warning border-warning">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                    <div>
                        <strong>Warning:</strong> Student scored perfect on MCQ but rated difficulty as <strong>"Hard"</strong>.
                    </div>
                </div>`;
        } else {
            auditBox.innerHTML = `
                <div class="alert-custom alert-custom-success">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    <div>
                        <strong>Info:</strong> Reflection ratings match the score.
                    </div>
                </div>`;
        }

        document.getElementById('currentGradingStudentNameHeader').innerText = studentObj.studentName;

        const loopContainer = document.getElementById('gradingQuestionsLoopContainer');
        loopContainer.innerHTML = "";

        studentObj.answers.forEach((a, idx) => {
            let rowHTML = `<div class="glass-card mb-3">`;
            rowHTML += `<span class="badge-custom badge-custom-cyan mb-2 d-inline-block">Question #${idx + 1} | Topic: ${a.questionTopic}</span>`;
            if (state.quizMode !== "PDF") {
                rowHTML += `<h6 class="fw-bold text-dark small">${a.questionPrompt}</h6>`;
            }

            // Per-question difficulty diagnostic pills
            rowHTML += `
                <div class="mb-3 d-flex flex-wrap gap-2">
                    <span class="badge text-dark border small" style="background-color: #f0fdf4; border-color: #bbf7d0 !important;">😊 Easy: ${a.easyRate}%</span>
                    <span class="badge text-dark border small" style="background-color: #fef8e7; border-color: #fde68a !important;">😐 Medium: ${a.mediumRate}%</span>
                    <span class="badge text-dark border small" style="background-color: #fef2f2; border-color: #fecaca !important;">😡 Hard: ${a.hardRate}%</span>
                </div>
            `;

            if (a.questionType === "MCQ") {
                const statusBadge = a.isCorrect
                    ? `<span class="badge-custom badge-custom-emerald">✓ Correct (+${a.maxScore} pts)</span>`
                    : `<span class="badge-custom badge-custom-rose">✗ Incorrect (+0.0 pts)</span>`;
                rowHTML += `
                    <div class="d-flex align-items-center gap-2 flex-wrap mt-2 p-2 rounded border" style="border-color: var(--border-color) !important; background: #f8faff;">
                        <span class="text-secondary small">🤖 Auto-Graded:</span>
                        <span class="small">Student response: <strong>Option "${a.studentAnswer || 'None'}"</strong></span>
                        ${statusBadge}
                    </div>`;
            } else if (a.questionType === "Essay") {
                let noteHTML = "";
                if (a.commentNote && a.commentNote.trim() && a.commentNote.trim() !== "No notes.") {
                    noteHTML = `<div class="p-2 border border-dashed rounded text-secondary small font-monospace mb-3" style="border-color: var(--border-color) !important;">Student Comment: "${a.commentNote}"</div>`;
                }

                let guideHTML = "";
                if (a.markingGuide && a.markingGuide.trim()) {
                    guideHTML = `
                        <div class="p-2.5 border rounded mb-2" style="background-color: #f0f9ff; border-color: #bae6fd !important; color: #0369a1;">
                            <strong class="small d-block mb-1" style="color: #0369a1;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" class="me-1" style="display:inline-block; vertical-align:text-bottom;"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>Marking Guidelines (Quiz Note):</strong>
                            <div class="small font-monospace" style="white-space: pre-wrap; font-size:12px;">${a.markingGuide}</div>
                        </div>`;
                }

                rowHTML += `
                    <label class="form-label small text-secondary fw-semibold mt-2">Student Response:</label>
                    <pre class="p-2 rounded text-cyan font-monospace bg-dark-subtle small mb-2 border" style="border-color: var(--border-color) !important; white-space: pre-wrap;">${a.studentAnswer || '// No response.'}</pre>
                    ${guideHTML}
                    ${noteHTML}
                    
                    <div class="p-3 border rounded bg-light" style="border-color: var(--border-color) !important;">
                        <h6 class="fw-bold text-dark mb-3" style="font-size: 13px;">Grade Question #${idx + 1}</h6>
                        
                        <div class="mb-3">
                            <label class="form-label text-secondary small fw-semibold">Score:</label>
                            <div class="input-group input-group-sm" style="width: 200px;">
                                <input type="number" step="0.1" min="0" max="${a.maxScore}" class="form-control text-center font-monospace fw-bold text-cyan grading-score-input" data-qid="${a.questionId}" value="${a.earnedScore}">
                                <span class="input-group-text bg-light text-secondary small">/ ${a.maxScore} pts</span>
                            </div>
                        </div>

                        <div class="mb-3">
                            <label class="form-label text-secondary small fw-semibold">Feedback / Comments:</label>
                            <input type="text" class="form-control form-control-sm grading-feedback-input" id="feedback-note-${a.questionId}" data-qid="${a.questionId}" placeholder="e.g., Semicolon missing at line 4 or spelling correction..." value="${a.teacherFeedback || ''}">
                        </div>

                        <div class="mb-3">
                            <label class="form-label text-secondary small fw-semibold d-block">Apply Error Tag:</label>
                            <div class="small text-secondary mb-2 italic">Active Selection: <strong class="text-rose" id="selected-tag-label-${a.questionId}">${(a.teacherTag && a.teacherTag !== 'Pending' && a.teacherTag !== 'Passed Evaluation Checklist') ? a.teacherTag : 'None'}</strong></div>
                            <div class="d-flex flex-wrap gap-2 mb-3 overflow-y-auto q-template-bank" style="max-height: 120px;" id="q-template-bank-${a.questionId}" data-qid="${a.questionId}">
                                <!-- Dynamic options for error tags -->
                            </div>
                        </div>

                        <div class="mb-2 p-2 border rounded bg-dark-subtle" style="border-color: var(--border-color) !important;">
                            <label class="form-label text-secondary small fw-semibold" style="font-size: 11px;">Create New Tag Template:</label>
                            <div class="input-group input-group-sm">
                                <input type="text" class="form-control" id="grow-input-${a.questionId}" placeholder="e.g. Memory leak on reference pointer...">
                                <button class="btn btn-outline-custom border-secondary btn-sm" onclick="generateGrowCardActionForQuestion(${a.questionId})">Add Template</button>
                            </div>
                        </div>
                    </div>
                `;
            }
            rowHTML += `</div>`;
            loopContainer.innerHTML += rowHTML;
        });

        if (isDisputeMode) {
            loadInstructorUnifiedDisputeChat(studentId);
        } else {
            renderInstructorPrivateTicketChatArea(studentId, studentObj.answers);
        }
        loadInstructorGrowCards(studentObj.answers);

        // Setup real-time score recalculation listener
        setTimeout(() => {
            const inputs = document.querySelectorAll('.grading-score-input');
            const totalHeader = document.getElementById('liveGradingTotalScoreHeader');
            if (inputs.length > 0 && totalHeader) {
                const recalc = () => {
                    let total = 0.0;
                    inputs.forEach(inp => {
                        total += parseFloat(inp.value) || 0.0;
                    });
                    studentObj.answers.forEach(a => {
                        if (a.questionType === "MCQ" && a.isCorrect) {
                            total += a.maxScore;
                        }
                    });
                    totalHeader.innerText = `Final Score: ${total.toFixed(1)} / ${state.totalScore} pts`;
                };
                inputs.forEach(inp => {
                    inp.addEventListener('input', recalc);
                });
            }
        }, 150);
    } catch (err) {
        alert(err.message);
    }
}

async function loadInstructorGrowCards(answers = null) {
    try {
        const res = await fetch(`${API_BASE}/instructor/error-tags`);
        if (!res.ok) return;
        state.errorTags = await res.json();

        const banks = document.querySelectorAll('.q-template-bank');
        banks.forEach(bank => {
            const qId = parseInt(bank.getAttribute('data-qid'));
            let defaultTag = null;
            if (answers) {
                const ansObj = answers.find(a => a.questionId === qId);
                if (ansObj && ansObj.teacherTag && ansObj.teacherTag !== "Pending" && ansObj.teacherTag !== "Passed Evaluation Checklist") {
                    defaultTag = ansObj.teacherTag;
                }
            }
            renderTemplateBankForQuestion(qId, defaultTag);
        });
    } catch (err) {
        console.error(err);
    }
}

function renderTemplateBankForQuestion(qId, selectedTag = null) {
    const group = document.getElementById(`q-template-bank-${qId}`);
    if (!group) return;

    group.innerHTML = "";

    state.errorTags.forEach((tag, idx) => {
        const container = document.createElement('div');
        container.className = "d-inline-flex align-items-center me-2 mb-2 p-1 border rounded bg-white shadow-sm error-tag-wrapper";
        container.style.borderColor = "var(--border-color) !important";

        const btn = document.createElement('div');
        btn.className = "error-tag-btn border-0 m-0 py-1 px-2.5 small fw-semibold";
        btn.style.cursor = "pointer";
        btn.style.borderRadius = "4px";
        if (selectedTag === tag) {
            btn.classList.add('selected');
            container.style.backgroundColor = "rgba(124, 58, 237, 0.08)";
            container.style.borderColor = "var(--accent-purple) !important";
        }
        btn.innerText = tag;
        btn.onclick = function () {
            selectTemplateCardForQuestion(qId, btn, tag);
        };

        const editBtn = document.createElement('span');
        editBtn.className = "ms-1 text-secondary px-1 text-center";
        editBtn.style.cursor = "pointer";
        editBtn.style.fontSize = "12px";
        editBtn.style.opacity = "0.6";
        editBtn.innerHTML = "✏️";
        editBtn.title = "Rename/Merge this error card template";
        editBtn.onclick = function (e) {
            e.stopPropagation();
            renameErrorTagPrompt(tag);
        };

        container.appendChild(btn);
        container.appendChild(editBtn);
        group.appendChild(container);
    });
}

function selectTemplateCardForQuestion(qId, element, tag) {
    const group = document.getElementById(`q-template-bank-${qId}`);
    if (!group) return;

    const wasSelected = element.classList.contains('selected');

    // Deselect other buttons in this group
    group.querySelectorAll('.error-tag-btn').forEach(btn => {
        btn.classList.remove('selected');
        const wrapper = btn.closest('.error-tag-wrapper');
        if (wrapper) {
            wrapper.style.backgroundColor = "white";
            wrapper.style.borderColor = "var(--border-color) !important";
        }
    });

    const label = document.getElementById(`selected-tag-label-${qId}`);

    if (wasSelected) {
        element.classList.remove('selected');
        if (label) {
            label.innerText = "None (Evaluating Asset as Compliant)";
        }
    } else {
        element.classList.add('selected');
        const wrapper = element.closest('.error-tag-wrapper');
        if (wrapper) {
            wrapper.style.backgroundColor = "rgba(124, 58, 237, 0.08)";
            wrapper.style.borderColor = "var(--accent-purple) !important";
        }
        if (label) {
            label.innerText = tag;
        }
    }
}

async function renameErrorTagPrompt(oldTag) {
    const newTag = prompt(`Rename / Merge error tag template "${oldTag}" to:`, oldTag);
    if (!newTag || newTag.trim() === oldTag) return;

    try {
        const res = await fetch(`${API_BASE}/instructor/rename-error-tag`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                oldTag: oldTag,
                newTag: newTag.trim()
            })
        });

        if (!res.ok) throw new Error("Failed to rename error tag template.");

        alert("✔ Template successfully renamed and merged across database records.");

        const titleQuery = state.selectedQuizTitle ? `?quizTitle=${encodeURIComponent(state.selectedQuizTitle)}` : "";
        const activeSubmissionsRes = await fetch(`${API_BASE}/student/mistake-bank/${state.activeGradingStudentID}${titleQuery}`);
        if (activeSubmissionsRes.ok) {
            const studentObj = await activeSubmissionsRes.json();
            loadInstructorGrowCards(studentObj.answers);
        } else {
            loadInstructorGrowCards();
        }
    } catch (err) {
        alert(err.message);
    }
}

async function generateGrowCardActionForQuestion(qId) {
    const inputEl = document.getElementById(`grow-input-${qId}`);
    const val = inputEl ? inputEl.value.trim() : "";
    if (!val) return alert("Type feedback template text parameters!");

    try {
        const formatted = `[F${state.errorTags.length + 1}] ${val}`;
        const res = await fetch(`${API_BASE}/instructor/error-tags`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formatted)
        });

        if (!res.ok) throw new Error();

        if (inputEl) inputEl.value = '';

        // Capture current selections in DOM
        const selections = {};
        const banks = document.querySelectorAll('.q-template-bank');
        banks.forEach(bank => {
            const currQId = parseInt(bank.getAttribute('data-qid'));
            const selectedBtn = bank.querySelector('.error-tag-btn.selected');
            selections[currQId] = selectedBtn ? selectedBtn.innerText : null;
        });

        // Auto-select the newly formatted tag for the current question
        selections[qId] = formatted;

        // Reload error tags list from server
        const resTags = await fetch(`${API_BASE}/instructor/error-tags`);
        if (resTags.ok) {
            state.errorTags = await resTags.json();
        }

        // Re-render all banks
        banks.forEach(bank => {
            const currQId = parseInt(bank.getAttribute('data-qid'));
            renderTemplateBankForQuestion(currQId, selections[currQId]);

            // Sync label text
            const label = document.getElementById(`selected-tag-label-${currQId}`);
            if (label) {
                label.innerText = selections[currQId] || "None (Evaluating Asset as Compliant)";
            }
        });

    } catch (err) {
        alert("Failed to create grow card template.");
    }
}

async function instructorSubmitEvaluation() {
    const grades = [];
    let hasError = false;

    const inputs = document.querySelectorAll('.grading-score-input');
    inputs.forEach(input => {
        const qId = parseInt(input.getAttribute('data-qid'));
        const maxScore = parseFloat(input.getAttribute('max'));
        const scoreVal = parseFloat(input.value);

        if (isNaN(scoreVal) || scoreVal < 0 || scoreVal > maxScore) {
            alert(`Please enter a valid score between 0 and ${maxScore} for Question.`);
            hasError = true;
            return;
        }

        const selectedBtn = document.querySelector(`#q-template-bank-${qId} .error-tag-btn.selected`);
        const chosenTag = selectedBtn ? selectedBtn.innerText : null;

        const feedbackField = document.getElementById(`feedback-note-${qId}`);
        const feedbackVal = feedbackField ? feedbackField.value.trim() : null;

        grades.push({
            questionId: qId,
            earnedScore: scoreVal,
            chosenTag: chosenTag,
            teacherFeedback: feedbackVal
        });
    });

    if (hasError) return;

    try {
        const payload = {
            studentId: state.activeGradingStudentID,
            quizTitle: state.selectedQuizTitle,
            grades: grades
        };

        const res = await fetch(`${API_BASE}/instructor/grade`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Failed to publish grade.");

        alert("✔ Evaluation results successfully committed to SQL Server.");
        const titleParam = state.selectedQuizTitle ? `?quizTitle=${encodeURIComponent(state.selectedQuizTitle)}` : "";
        window.location.href = "/Instructor/Dashboard" + titleParam;
    } catch (err) {
        alert(err.message);
    }
}

async function loadInstructorUnifiedDisputeChat(studentId) {
    const streamContainer = document.getElementById('instructorUnifiedDisputeChatStream');
    if (!streamContainer) return;

    try {
        const topic = `Dispute ${studentId} - ${state.selectedQuizTitle || state.activeTaskTitle}`;
        const res = await fetch(`${API_BASE}/forum/dispute/${studentId}/${encodeURIComponent(topic)}`);
        if (!res.ok) throw new Error();

        const comments = await res.json();
        streamContainer.innerHTML = comments.map(c => {
            const isSelf = c.sender.includes("Instructor");
            return `
                <div class="comment-bubble ${isSelf ? 'self' : ''}">
                    <span class="d-block small fw-bold" style="color: var(--accent-cyan); font-size: 11px;">${c.sender}</span>
                    <span style="font-size: 12.5px;">${c.message}</span>
                </div>`;
        }).join('');

        streamContainer.scrollTop = streamContainer.scrollHeight;
    } catch (err) {
        streamContainer.innerHTML = `<div class="text-center text-secondary small py-3">Error loading messages.</div>`;
    }
}

async function sendInstructorUnifiedDisputeComment(studentId) {
    const field = document.getElementById('inputInstructorUnifiedDisputeMessage');
    if (!field || !field.value.trim()) return;

    try {
        const topic = `Dispute ${studentId} - ${state.selectedQuizTitle || state.activeTaskTitle}`;
        const payload = {
            isPrivate: true,
            studentId: studentId,
            topic: topic,
            sender: "Dr. Ali Bayeh (Instructor)",
            message: field.value.trim()
        };

        const res = await fetch(`${API_BASE}/forum/comment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Failed to send message.");

        field.value = "";
        await loadInstructorUnifiedDisputeChat(studentId);
    } catch (err) {
        alert(err.message);
    }
}

async function resolveInstructorSubmissionDispute(studentId, isApproved) {
    let grades = [];
    let hasError = false;
    const inputs = document.querySelectorAll('.grading-score-input');
    inputs.forEach(inp => {
        const qId = parseInt(inp.getAttribute('data-qid'));
        const scoreVal = parseFloat(inp.value);
        const maxScore = parseFloat(inp.getAttribute('max')) || 10.0;
        if (isNaN(scoreVal) || scoreVal < 0 || scoreVal > maxScore) {
            alert(`Please enter a valid score between 0 and ${maxScore} for Question.`);
            hasError = true;
            return;
        }

        const selectedBtn = document.querySelector(`#q-template-bank-${qId} .error-tag-btn.selected`);
        const chosenTag = selectedBtn ? selectedBtn.innerText : null;

        const feedbackField = document.getElementById(`feedback-note-${qId}`);
        const feedbackVal = feedbackField ? feedbackField.value.trim() : null;

        grades.push({
            questionId: qId,
            earnedScore: scoreVal,
            chosenTag: chosenTag,
            teacherFeedback: feedbackVal
        });
    });

    if (hasError) return;

    try {
        // Save the updated grades first
        const gradePayload = {
            studentId: studentId,
            quizTitle: state.selectedQuizTitle || state.activeTaskTitle,
            grades: grades
        };

        const resGrade = await fetch(`${API_BASE}/instructor/grade`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(gradePayload)
        });

        if (!resGrade.ok) throw new Error("Failed to save updated grades.");

        // Now resolve the dispute
        const disputePayload = {
            studentId: studentId,
            quizTitle: state.selectedQuizTitle || state.activeTaskTitle,
            isApproved: isApproved
        };

        const resDispute = await fetch(`${API_BASE}/instructor/resolve-submission-dispute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(disputePayload)
        });

        if (!resDispute.ok) throw new Error("Failed to resolve dispute status.");

        alert(isApproved ? "🟢 Dispute approved, grades saved, and override committed successfully!" : "❌ Dispute rejected and initial evaluation parameters sustained.");
        const titleParam = state.selectedQuizTitle ? `?quizTitle=${encodeURIComponent(state.selectedQuizTitle)}` : "";
        window.location.href = "/Instructor/Dashboard" + titleParam;
    } catch (err) {
        alert(err.message);
    }
}

async function renderInstructorPrivateTicketChatArea(studentId, answers) {
    const area = document.getElementById('instructorPrivateTicketChatAreaZone');
    if (!area) return;

    const essayAnswers = answers.filter(a => a.questionType === "Essay");
    if (essayAnswers.length === 0) {
        area.innerHTML = `<div class="text-center p-4 text-secondary small">No essay question found to evaluate.</div>`;
        return;
    }

    area.innerHTML = "";
    let disputeCount = 0;

    for (const q of essayAnswers) {
        try {
            const resChat = await fetch(`${API_BASE}/forum/dispute/${studentId}/Dispute Q${q.questionId}`);
            if (!resChat.ok) continue;

            const comments = await resChat.json();
            if (comments.length === 0) continue; // No dispute opened for this question

            disputeCount++;

            const chatStream = comments.map(c => {
                const isSelf = c.sender.includes("Instructor");
                return `<div class="comment-bubble ${isSelf ? 'self' : ''}">
                    <span class="d-block small fw-bold" style="color: var(--accent-cyan); font-size: 11px;">${c.sender}</span>
                    <span style="font-size: 12.5px;">${c.message}</span>
                </div>`;
            }).join('');

            const disputeCard = document.createElement('div');
            disputeCard.className = "mb-4 p-3 border rounded bg-light";
            disputeCard.style.borderColor = "var(--border-color) !important";

            disputeCard.innerHTML = `
                <div class="chat-window p-3">
                    <div class="d-flex justify-content-between align-items-center mb-3 text-secondary border-bottom border-secondary pb-2 small">
                        <strong>🔒 Private Dispute Room: Question ${q.questionId} (Topic: ${q.questionTopic})</strong>
                    </div>
                    <div class="chat-message-stream mb-3" style="max-height: 200px; overflow-y: auto;">${chatStream}</div>
                    <div class="input-group input-group-sm mb-4">
                        <input type="text" id="inputInstructorEmbeddedChatText-${q.questionId}" class="form-control" placeholder="Post response message...">
                        <button class="btn btn-dark-custom btn-sm" onclick="dispatchInstructorEmbeddedChat('${studentId}', ${q.questionId})">Send</button>
                    </div>
                    
                    <div class="p-3 border rounded bg-dark-subtle" style="border-color: var(--accent-rose) !important;">
                        <span class="small fw-bold text-rose d-block mb-2">🔧 VARIABLE MANUAL CREDIT OVERRIDE CONTROLLER:</span>
                        <div class="row g-2 align-items-center mb-3">
                            <div class="col-auto"><label class="small text-white fw-semibold">Mutate score attribute register to:</label></div>
                            <div class="col-4">
                                <input type="number" step="0.1" min="0" max="${q.maxScore}" id="inputManualOverrideScore-${q.questionId}" class="form-control text-center font-monospace fw-bold text-danger" value="${q.earnedScore}">
                            </div>
                            <div class="col-auto"><span class="small text-secondary">/ Max ${q.maxScore} pts</span></div>
                        </div>
                        <div class="d-grid gap-2">
                            <button class="btn btn-sm btn-success py-2 fw-semibold" onclick="executeInstructorManualScoreOverride('${studentId}', ${q.questionId}, true)">🟢 APPROVE DISPUTE & COMMIT OVERRIDE</button>
                            <button class="btn btn-sm btn-outline-custom border-danger text-rose py-2 fw-semibold" onclick="executeInstructorManualScoreOverride('${studentId}', ${q.questionId}, false)">❌ DENY DISPUTE & LOCK SCORE</button>
                        </div>
                    </div>
                </div>
            `;
            area.appendChild(disputeCard);
        } catch (err) {
            console.error(err);
        }
    }

    if (disputeCount === 0) {
        area.innerHTML = `<div class="text-center p-4 text-secondary border border-dashed rounded small" style="border-color: var(--border-color) !important;">No active dispute tickets found for this student.</div>`;
    }
}

async function dispatchInstructorEmbeddedChat(studentId, qId) {
    const val = document.getElementById(`inputInstructorEmbeddedChatText-${qId}`).value;
    if (!val) return;

    try {
        const payload = {
            isPrivate: true,
            studentId: studentId,
            topic: "Dispute Q" + qId,
            sender: "Dr. Ali Bayeh (Instructor)",
            message: val
        };

        const res = await fetch(`${API_BASE}/forum/comment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Failed to post message.");

        routeTargetStudentToEvaluationDesk(studentId);
    } catch (err) {
        alert(err.message);
    }
}

async function executeInstructorManualScoreOverride(studentId, qId, isApproved) {
    let overrideScoreVal = 0;
    if (isApproved) {
        const scoreInput = document.getElementById(`inputManualOverrideScore-${qId}`);
        overrideScoreVal = parseFloat(scoreInput.value);
        const maxAttr = parseFloat(scoreInput.getAttribute('max')) || 10.0;
        if (isNaN(overrideScoreVal) || overrideScoreVal < 0 || overrideScoreVal > maxAttr) {
            return alert(`Invalid override score value. Must be between 0 and ${maxAttr}.`);
        }
    }

    try {
        const payload = {
            studentId: studentId,
            quizTitle: state.selectedQuizTitle,
            questionId: qId,
            isApproved: isApproved,
            manualOverrideScore: overrideScoreVal
        };

        const res = await fetch(`${API_BASE}/instructor/resolve-dispute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Failed to commit override.");

        alert(isApproved ? "Dispute approved. DB point overrides completed successfully!" : "Dispute closed and locks sustained.");
        const titleParam = state.selectedQuizTitle ? `?quizTitle=${encodeURIComponent(state.selectedQuizTitle)}` : "";
        window.location.href = "/Instructor/Dashboard" + titleParam;
    } catch (err) {
        alert(err.message);
    }
}



// ================= COURSE FORUM SYSTEM =================

const STUDY_GUIDES = {
    "Arrays": "📚 Unlocked Study Guide: Review index boundaries, off-by-one errors, array declarations, and length vs. index indexing logic.",
    "Recursion": "📚 Unlocked Study Guide: Review your base cases to prevent infinite recursion and stack overflow errors. Trace values manually on a call stack.",
    "Loops": "📚 Unlocked Study Guide: Watch out for infinite loops, variable updates inside the loop body, and correct boundary checking conditions.",
    "Strings": "📚 Unlocked Study Guide: Remember that string indices are 0-based, strings are immutable in many languages, and pay attention to substring bounds.",
    "Methods": "📚 Unlocked Study Guide: Ensure parameter counts and type signatures match exactly. Track scope and returns.",
    "Conditionals": "📚 Unlocked Study Guide: Verify boolean operator logic, use of block braces, and proper nesting of if-else statements."
};

function parseLocalDateString(dateStr) {
    if (!dateStr) return null;
    try {
        const clean = dateStr.replace(' ', 'T');
        const withOffset = clean.includes('T') && !clean.includes('Z') && !clean.includes('-06:00')
            ? `${clean}-06:00`
            : clean;
        const d = new Date(withOffset);
        if (!isNaN(d.getTime())) {
            return d;
        }
    } catch (_) { }
    return null;
}

function formatLocalDateTime(dateStr) {
    if (!dateStr) return "";
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return "";
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Regina',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
        const formatted = formatter.format(d);
        const parts = formatted.split(', ');
        const dateParts = parts[0].split('/');
        const timeParts = parts[1].split(':');

        const year = dateParts[2];
        const month = dateParts[0];
        const day = dateParts[1];
        const hours = timeParts[0];
        const minutes = timeParts[1];

        return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch (_) { }
    return dateStr ? dateStr.substring(0, 16) : "";
}

function formatInReginaTimezone(dateStr) {
    if (!dateStr) return "";
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return "";
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Regina',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
        return formatter.format(d);
    } catch (_) { }
    return dateStr;
}

function convertReginaToUtcIso(val) {
    if (!val) return null;
    try {
        const dateStr = val.includes('T') && !val.includes('-06:00') ? `${val}-06:00` : val;
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
            return d.toISOString();
        }
    } catch (_) { }
    return val;
}

function getStudyGuideForTopic(topic) {
    if (!topic || topic === "General Discussion Hub") return null;

    // Case insensitive lookup
    const normalized = topic.trim().toLowerCase();
    for (const key in STUDY_GUIDES) {
        if (normalized.includes(key.toLowerCase()) || key.toLowerCase().includes(normalized)) {
            return STUDY_GUIDES[key];
        }
    }
    return `📚 Unlocked Study Guide: Review key concepts and core definitions of ${topic} to identify logic discrepancies.`;
}

async function initializeForumPage() {
    const container = document.getElementById('student-forum-container-target');
    if (!container) return;

    try {
        // Fetch all quizzes to populate the selector
        const resQuizzes = await fetch(`${API_BASE}/questions/quizzes`);
        if (!resQuizzes.ok) throw new Error("Failed to load quizzes list.");
        const quizzes = await resQuizzes.json();

        if (quizzes.length === 0) {
            container.innerHTML = `
                <div class="glass-panel text-center py-5">
                    <h5 class="fw-semibold text-secondary">No quizzes published yet.</h5>
                </div>`;
            return;
        }

        const urlParams = new URLSearchParams(window.location.search);
        let quizTitleParam = urlParams.get('quizTitle') || state.selectedQuizTitle || state.activeTaskTitle;

        // Default to first quiz if not set or not found
        if (!quizTitleParam || !quizzes.some(q => (q.title || q.Title) === quizTitleParam)) {
            quizTitleParam = quizzes[0].title || quizzes[0].Title;
        }

        state.selectedQuizTitle = quizTitleParam;

        const titleQuery = `?quizTitle=${encodeURIComponent(quizTitleParam)}`;
        const resQ = await fetch(`${API_BASE}/questions${titleQuery}`);
        if (!resQ.ok) throw new Error("Failed to load forum status.");
        const dataQ = await resQ.json();
        const isForumActive = dataQ.isForumOpen ?? true;

        state.activeTaskTitle = dataQ.title;
        state.isForumOpen = isForumActive;
        state.quizMode = dataQ.quizMode ?? "Manual";
        state.deadlineString = dataQ.deadlineString || dataQ.DeadlineString || null;

        // Generate dropdown options
        const selectOptionsHTML = quizzes.map(q => {
            const title = q.title || q.Title;
            return `<option value="${title}" ${title === quizTitleParam ? 'selected' : ''}>${title}</option>`;
        }).join('');

        const selectorHTML = `
            <div class="glass-panel p-3 mb-4 d-flex align-items-center gap-3">
                <span class="text-secondary small fw-bold text-uppercase d-flex align-items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    Select Quiz Context:
                </span>
                <select id="forumQuizSelectDropdown" class="form-select form-select-sm bg-white text-dark" style="max-width: 320px;" onchange="onForumQuizDropdownChange(this.value)">
                    ${selectOptionsHTML}
                </select>
            </div>`;

        if (!isForumActive) {
            container.innerHTML = selectorHTML + `
                <div class="glass-panel text-center py-5">
                    <h5 class="fw-bold text-rose mb-3">&#x1F4AC; Course Forum Hub Locked</h5>
                    <p class="text-secondary small">The instructor has closed active discussions for this assessment cycle.</p>
                </div>`;
            return;
        }

        // Fetch error tags list
        const resTags = await fetch(`${API_BASE}/instructor/error-tags`);
        if (!resTags.ok) throw new Error("Failed to load tags.");
        const tags = await resTags.json();

        // Teacher → render teacher forum dashboard
        if (state.user.role === 'teacher') {
            await renderTeacherForumInterface(tags, 'student-forum-container-target', selectorHTML);
            return;
        }

        // Student → load mistake bank to populate state.failedTags
        state.failedTags = [];
        try {
            const resBank = await fetch(`${API_BASE}/student/mistake-bank/${state.user.id}${titleQuery}`);
            if (resBank.ok) {
                const dataBank = await resBank.json();
                if (dataBank.status === "Graded") {
                    dataBank.answers.forEach(ans => {
                        if (ans.isCorrect === false && ans.teacherTag && ans.teacherTag !== "Pending" && ans.teacherTag !== "Passed Evaluation Checklist") {
                            state.failedTags.push(ans.teacherTag);
                        }
                    });
                    state.failedTags = [...new Set(state.failedTags)];
                }
            }
        } catch (_) { /* ignore */ }

        // Fetch resources for failed tags in parallel
        const resourcePromises = state.failedTags.map(async (tag) => {
            const scopedTopic = `${state.activeTaskTitle} - Resource - ${tag}`;
            const res = await fetch(`${API_BASE}/forum/${encodeURIComponent(scopedTopic)}`);
            if (res.ok) {
                const comments = await res.json();
                return { tag, comments };
            }
            return { tag, comments: [] };
        });
        const resources = await Promise.all(resourcePromises);

        renderStudentForumInterface(resources, selectorHTML);

    } catch (err) {
        container.innerHTML = `<div class="alert-custom alert-custom-warning small">Error loading forum: ${err.message}</div>`;
    }
}

function onForumQuizDropdownChange(val) {
    state.selectedQuizTitle = val;
    const newUrl = window.location.pathname + '?quizTitle=' + encodeURIComponent(val);
    window.history.pushState({ path: newUrl }, '', newUrl);
    initializeForumPage();
}

function renderStudentForumInterface(resources, selectorHTML = '') {
    const container = document.getElementById('student-forum-container-target');
    if (!container) return;

    let resourcesHTML = "";
    if (resources.length > 0) {
        resourcesHTML = `
            <div class="glass-panel mb-4" style="border-color: var(--accent-indigo) !important; background-color: rgba(99, 102, 241, 0.02);">
                <h5 class="fw-bold text-dark mb-2 d-flex align-items-center gap-1" style="font-family: var(--font-heading);">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    🔓 Unlocked Study Materials for Your Mistakes
                </h5>
                <p class="text-secondary small mb-3">The instructor has posted review resources specifically targeting the defects identified in your submission.</p>
                <div class="d-flex flex-column gap-3">`;

        resources.forEach(r => {
            let materialsListHTML = "";
            if (r.comments.length === 0) {
                materialsListHTML = `<div class="text-secondary small italic ps-3">No study materials posted yet for this error tag.</div>`;
            } else {
                materialsListHTML = `<ul class="mb-0 ps-4 small text-dark">` + r.comments.map(c => {
                    return `<li class="mb-1">${c.message}</li>`;
                }).join('') + `</ul>`;
            }

            resourcesHTML += `
                <div class="p-3 border rounded bg-white" style="border-color: var(--border-color) !important;">
                    <strong class="text-rose small d-block mb-2">Tag: ${r.tag}</strong>
                    ${materialsListHTML}
                </div>`;
        });

        resourcesHTML += `</div></div>`;
    }

    container.innerHTML = selectorHTML + resourcesHTML + `
        <div id="general-forum-chat-viewport"></div>`;

    renderUnifiedForumComponent('general-forum-chat-viewport', 'General Q&A');
}

async function initializeInstructorDashboardForum() {
    const container = document.getElementById('standalone-teacher-forum-container');
    if (!container) return;

    try {
        const titleQuery = state.selectedQuizTitle ? `?quizTitle=${encodeURIComponent(state.selectedQuizTitle)}` : "";
        const resQ = await fetch(`${API_BASE}/questions${titleQuery}`);
        if (!resQ.ok) throw new Error();
        const dataQ = await resQ.json();

        state.activeTaskTitle = dataQ.title;
        state.isForumOpen = dataQ.isForumOpen ?? true;
        state.quizMode = dataQ.quizMode ?? "Manual";
        state.deadlineString = dataQ.deadlineString || dataQ.DeadlineString || null;

        const resTags = await fetch(`${API_BASE}/instructor/error-tags`);
        if (!resTags.ok) throw new Error();
        const tags = await resTags.json();

        await renderTeacherForumInterface(tags, 'standalone-teacher-forum-container');
    } catch (err) {
        container.innerHTML = `<div class="alert-custom alert-custom-warning small">Error loading forum rooms: ${err.message}</div>`;
    }
}

async function renderTeacherForumInterface(tags, targetContainerId = 'standalone-teacher-forum-container', selectorHTML = '') {
    const container = document.getElementById(targetContainerId);
    if (!container) return;

    const resourcePromises = tags.map(async (tag) => {
        const scopedTopic = `${state.activeTaskTitle} - Resource - ${tag}`;
        const res = await fetch(`${API_BASE}/forum/${encodeURIComponent(scopedTopic)}`);
        if (res.ok) {
            const comments = await res.json();
            return { tag, comments };
        }
        return { tag, comments: [] };
    });
    const resources = await Promise.all(resourcePromises);

    const selectOptionsHTML = tags.map(tag => `<option value="${tag}">${tag}</option>`).join('');

    let postedResourcesHTML = `<div class="d-flex flex-column gap-2 mt-3" style="max-height: 250px; overflow-y: auto;">`;
    let hasResources = false;
    resources.forEach(r => {
        if (r.comments.length > 0) {
            hasResources = true;
            postedResourcesHTML += `
                <div class="p-2 border rounded bg-white small shadow-sm" style="border-color: var(--border-color) !important;">
                    <strong class="text-rose d-block mb-1">${r.tag}</strong>
                    <ul class="mb-0 ps-3">
                        ${r.comments.map(c => `<li>${c.message}</li>`).join('')}
                    </ul>
                </div>`;
        }
    });
    if (!hasResources) {
        postedResourcesHTML += `<div class="text-secondary small italic py-2">No study materials posted yet. Use the fields above to post.</div>`;
    }
    postedResourcesHTML += `</div>`;

    container.innerHTML = selectorHTML + `
        <div class="row g-4">
            <!-- Left Column: Manage Study Materials -->
            <div class="col-lg-5">
                <div class="glass-panel h-100">
                    <h5 class="fw-bold text-dark mb-3" style="font-family: var(--font-heading);">📎 Post Study Resource for Error Tag</h5>
                    <p class="text-secondary small mb-3">Upload files/study materials targeted at students who received specific feedback tags.</p>
                    
                    <div class="mb-3">
                        <label class="form-label text-secondary small fw-semibold">Select Feedback Tag:</label>
                        <select id="resourceFeedbackTagSelect" class="form-select form-select-sm bg-white text-dark">
                            ${selectOptionsHTML}
                        </select>
                    </div>
                    <div class="mb-3">
                        <label class="form-label text-secondary small fw-semibold">Resource Title:</label>
                        <input type="text" id="resourceTitleInput" class="form-control form-control-sm bg-white text-dark" placeholder="e.g. Lecture 3: Logic flow guide">
                    </div>
                    <div class="mb-3">
                        <label class="form-label text-secondary small fw-semibold">URL or Reference Link:</label>
                        <input type="text" id="resourceUrlInput" class="form-control form-control-sm bg-white text-dark" placeholder="e.g. https://example.com/slides">
                    </div>
                    <button class="btn btn-sm btn-dark-custom w-100 fw-bold py-2" onclick="teacherSubmitResource()">Post Study Material</button>

                    <hr class="my-4 border-secondary">

                    <h6 class="fw-bold text-dark mb-2" style="font-size:13px; font-family: var(--font-heading);">Active Posted Resources</h6>
                    ${postedResourcesHTML}
                </div>
            </div>
            
            <!-- Right Column: General Q&A Chat Room -->
            <div class="col-lg-7">
                <div id="general-forum-chat-viewport"></div>
            </div>
        </div>`;

    renderUnifiedForumComponent('general-forum-chat-viewport', 'General Q&A');
}

async function teacherSubmitResource() {
    const tag = document.getElementById('resourceFeedbackTagSelect').value;
    const title = document.getElementById('resourceTitleInput').value.trim();
    const url = document.getElementById('resourceUrlInput').value.trim();

    if (!title || !url) {
        return alert("Please fill in both the title and URL/description.");
    }

    const message = `&#x1F4CE; [Study Material] ${title} — ${url}`;
    const scopedTopic = `${state.activeTaskTitle} - Resource - ${tag}`;

    try {
        const res = await fetch(`${API_BASE}/forum/comment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                isPrivate: false,
                studentId: 'all',
                topic: scopedTopic,
                sender: `${state.user.name} (Instructor)`,
                message: message
            })
        });

        if (!res.ok) throw new Error("Failed to post resource.");

        alert("✔ Study resource posted successfully for tag: " + tag);

        document.getElementById('resourceTitleInput').value = '';
        document.getElementById('resourceUrlInput').value = '';

        const targetContainer = document.getElementById('student-forum-container-target');
        if (targetContainer) {
            await initializeForumPage();
        } else {
            await initializeInstructorDashboardForum();
        }
    } catch (err) {
        alert("Error posting resource: " + err.message);
    }
}

function switchForumTopic(topic, tabId, viewportId) {
    const clickedTab = document.getElementById(tabId);
    if (clickedTab) {
        const parent = clickedTab.parentElement;
        if (parent) {
            parent.querySelectorAll('.sub-tab-link').forEach(link => {
                link.classList.remove('active');
            });
        }
        clickedTab.classList.add('active');
    }

    renderUnifiedForumComponent(viewportId, topic);
}

async function renderUnifiedForumComponent(targetContainerID, filterTopic) {
    const container = document.getElementById(targetContainerID);
    if (!container) return;

    try {
        const scopedTopic = `${state.activeTaskTitle} - ${filterTopic}`;
        const res = await fetch(`${API_BASE}/forum/${encodeURIComponent(scopedTopic)}`);
        if (!res.ok) throw new Error();
        const comments = await res.json();

        const commentsHTMLStream = comments.map(c => {
            const isSelf = c.sender.includes(state.user.name);
            return `
                <div class="comment-bubble ${isSelf ? 'self' : ''}">
                    <span class="d-block small fw-bold" style="color: var(--accent-cyan); font-size: 11px;">${c.sender}</span>
                    <span style="font-size: 12.5px;">${c.message}</span>
                </div>`;
        }).join('');

        let isPastDeadline = false;
        if (state.deadlineString) {
            const deadline = parseLocalDateString(state.deadlineString);
            if (deadline && new Date() > deadline) {
                isPastDeadline = true;
            }
        }

        const isForumActive = (state.isForumOpen ?? true) && !isPastDeadline;

        container.innerHTML = `
            <div class="glass-panel p-3">
                <h5 class="fw-bold text-dark border-bottom border-secondary pb-2 mb-3">💬 Course Forum Hub Room: ${filterTopic} for ${state.activeTaskTitle}</h5>
                <div class="chat-window">
                    <div class="chat-header">Active Public Discussion Stream</div>
                    <div class="p-3">
                        <div class="chat-message-stream mb-3" style="height: 280px; overflow-y: auto;">
                            ${commentsHTMLStream}
                        </div>
                        ${isForumActive ? `
                        <div class="input-group">
                            <input type="text" id="inputLiveCommentTextString-${targetContainerID}" class="form-control" placeholder="Post a query peer comment...">
                            <button class="btn btn-dark-custom" onclick="dispatchLiveCommentSubmission('${targetContainerID}', '${filterTopic}')">Comment</button>
                        </div>` : `
                        <div class="alert-custom alert-custom-warning small text-center">
                            🔒 This discussion room is locked ${isPastDeadline ? '(Due Date has passed)' : 'by the instructor'}.
                        </div>`}
                    </div>
                </div>
            </div>`;
    } catch (err) {
        container.innerHTML = `<div class="alert-custom alert-custom-warning small">Error loading forum comments.</div>`;
    }
}

async function dispatchLiveCommentSubmission(targetContainerID, filterTopic) {
    const field = document.getElementById(`inputLiveCommentTextString-${targetContainerID}`);
    if (!field || !field.value) return;

    try {
        const scopedTopic = `${state.activeTaskTitle} - ${filterTopic}`;
        const payload = {
            isPrivate: false,
            studentId: "all",
            topic: scopedTopic,
            sender: `${state.user.name} (${state.user.role === 'student' ? 'Student' : 'Instructor'})`,
            message: field.value
        };

        const res = await fetch(`${API_BASE}/forum/comment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error();

        field.value = ''; // Clear text input after posting
        renderUnifiedForumComponent(targetContainerID, filterTopic);
    } catch (err) {
        alert("Failed to post comment.");
    }
}
// Page-based router initialization on DOM Load
window.addEventListener('DOMContentLoaded', async () => {
    // Restore session from SafeStorage if exists
    const savedUser = SafeStorage.getItem('caselab_user');
    if (savedUser) {
        state.user = JSON.parse(savedUser);
        const sessionArea = document.getElementById('appUserSession');
        if (sessionArea) sessionArea.style.display = "flex";

        const avatar = document.getElementById('sessionAvatar');
        if (avatar) {
            avatar.innerText = state.user.name.split(' ').map(n => n[0]).join('').toUpperCase();
            avatar.style.backgroundColor = state.user.role === 'student' ? 'var(--accent-indigo)' : 'var(--accent-cyan)';
        }

        const nameDisp = document.getElementById('sessionNameDisplay');
        if (nameDisp) {
            nameDisp.innerText = `${state.user.name} (${state.user.role === 'student' ? 'Student' : 'Instructor'})`;
        }

        // Start notification polling — fetch immediately then every 30 seconds
        fetchNotifications();
        state._notifPollInterval = setInterval(fetchNotifications, 30000);
    }

    // Proactively fetch current quiz config to populate globally
    try {
        const resQ = await fetch(`${API_BASE}/questions`);
        if (resQ.ok) {
            const dataQ = await resQ.json();
            state.activeTaskTitle = dataQ.title;
            state.questions = dataQ.questions;
            state.timeLimitMinutes = dataQ.timeLimitMinutes ?? 40;
            state.isQuizOpen = dataQ.isQuizOpen ?? true;
            state.isForumOpen = dataQ.isForumOpen ?? true;
            state.deadlineString = dataQ.deadlineString ?? null;
            state.pdfBase64 = dataQ.pdfBase64 ?? null;
            state.quizMode = dataQ.quizMode ?? "Manual";
            state.totalScore = dataQ.totalScore ?? 10.0;
        }
    } catch (err) {
        console.error("Failed to preload active questions config: ", err);
    }

    // Set up PDF file upload listener
    const pdfInput = document.getElementById('inputQuizPdf');
    if (pdfInput) {
        pdfInput.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (!file) return;
            if (file.type !== "application/pdf") {
                alert("Please select a valid PDF file.");
                e.target.value = "";
                return;
            }
            const reader = new FileReader();
            reader.onload = function (evt) {
                state.pdfBase64 = evt.target.result;
                const statusLabel = document.getElementById('quizPdfStatusLabel');
                if (statusLabel) {
                    statusLabel.innerText = `✔ Attached: ${file.name}`;
                }
            };
            reader.readAsDataURL(file);
        });
    }

    const path = window.location.pathname.toLowerCase();

    if (path.includes('/student/dashboard')) {
        renderStudentDashboard();
    } else if (path.includes('/student/exam')) {
        loadQuestionsForExam();
    } else if (path.includes('/student/mistakebank')) {
        openStudentMistakeBankWithReload();
    } else if (path.includes('/instructor/dashboard')) {
        const urlParams = new URLSearchParams(window.location.search);
        const qTitle = urlParams.get('quizTitle');
        if (qTitle) {
            state.selectedQuizTitle = qTitle;
        }
        await loadQuizzesSidebar();
        await switchTeacherTab('analytics');
    } else if (path.includes('/instructor/grading')) {
        const urlParams = new URLSearchParams(window.location.search);
        const sId = urlParams.get('studentId');
        const qTitle = urlParams.get('quizTitle');
        if (qTitle) {
            state.selectedQuizTitle = qTitle;
        }
        if (sId) {
            routeTargetStudentToEvaluationDesk(sId);
        }
    } else if (path.includes('/forum')) {
        initializeForumPage();
    }
});
