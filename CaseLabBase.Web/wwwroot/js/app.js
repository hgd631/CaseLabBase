// CaseLabBase - Client Script (app.js)
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
    // Member 1- Han:  Post credentials to auth login API and route session user to their dashboard.
    try {
        const res = await fetch(`${API_BASE}/auth/users/${userId}`);
        if (!res.ok) throw new Error("Could not log in user.");

        state.user = await res.json();
        localStorage.setItem('caselab_user', JSON.stringify(state.user));

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
    localStorage.removeItem('caselab_user');
    clearInterval(state.examTimerInterval);
    clearInterval(state._notifPollInterval);
    window.location.href = "/";
}

// ================= NOTIFICATION SYSTEM =================

//Member 1-Han: Implement notification polling, dropdown UI, and mark-all-read functionality.
// State variable to track whether the notification dropdown UI is currently open
let _notifDropdownOpen = false;

async function fetchNotifications() {
    // 1. Guard Clause: If there is no logged-in user in the global state, stop immediately
    if (!state.user) return;

    try {
        // 2. HTTP Request: Fetch user-specific notifications based on their ID and Role
        const res = await fetch(`${API_BASE}/notifications?userId=${state.user.id}&role=${state.user.role}`);
        if (!res.ok) return; // If the server responds with an error status (e.g., 400 or 500), abort

        // 3. Parse JSON: Convert the raw response stream into a usable JavaScript object
        const data = await res.json();

        // 4. DOM Elements: Grab the badge (unread counter) and list (the dropdown container) elements
        const badge = document.getElementById('notifBadge');
        const list = document.getElementById('notifList');
        if (!badge || !list) return; // Safety check: if elements don't exist in HTML, stop to avoid errors

        // 5. Update Badge UI: Show/hide and update the unread notifications count
        if (data.unreadCount > 0) {
            badge.style.display = 'block'; // Make badge visible
            // If count is greater than 9, display "9+", otherwise show the actual number
            badge.textContent = data.unreadCount > 9 ? '9+' : data.unreadCount;
        } else {
            badge.style.display = 'none'; // Hide badge if there are 0 unread notifications
        }

        // 6. Handle Empty State: If the user has zero notifications total, display a placeholder message
        if (data.notifications.length === 0) {
            list.innerHTML = '<p class="text-secondary small text-center py-4" style="margin:0;">No notifications yet</p>';
            return;
        }

        // 7. Render Notifications List: Loop through the array and map each notification to an HTML string
        list.innerHTML = data.notifications.map(n => `
            <div onclick="${n.linkUrl ? `window.location='${n.linkUrl}'` : ''}"
                 style="padding:12px 16px; border-bottom:1px solid #f1f5f9; cursor:${n.linkUrl ? 'pointer' : 'default'};
                        background:${n.isRead ? '#fff' : '#f5f3ff'}; transition:background 0.15s;"
                 onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='${n.isRead ? '#fff' : '#f5f3ff'}'">
                <div class="d-flex align-items-start gap-2">
                    <span style="font-size:16px; margin-top:1px;">${n.isRead ? '🔔' : '🔴'}</span>
                    <div style="flex:1; min-width:0;">
                        <p class="fw-semibold mb-0" style="font-size:12px; color:#1e293b;">${n.title}</p>
                        <p class="text-secondary mb-0" style="font-size:11px; white-space:normal;">${n.message}</p>
                        <p class="mb-0" style="font-size:10px; color:#94a3b8; margin-top:2px;">${new Date(n.createdAt).toLocaleString()}</p>
                    </div>
                </div>
            </div>`).join(''); // .join('') turns the mapped array of HTML strings into one clean string for innerHTML

    } catch (_) {
        /* Fail Silently: Catch network errors (like offline status) so the entire app doesn't crash */
    }
}

async function clickNotification(id, linkUrl) {
    try {
        await fetch(`${API_BASE}/notifications/mark-single-read/${id}`, { method: 'POST' });
    } catch (_) { }

    if (linkUrl) {
        window.location = linkUrl;
    } else {
        await fetchNotifications();
    }
}

function toggleNotifDropdown() {
    const dropdown = document.getElementById('notifDropdown');
    if (!dropdown) return;
    _notifDropdownOpen = !_notifDropdownOpen;
    dropdown.style.display = _notifDropdownOpen ? 'block' : 'none';
    if (_notifDropdownOpen) fetchNotifications();
}


// Member 1-Han : Send POST request to notification mark-read endpoint and refresh current feed state.
async function markAllNotifsRead() {
  
    // 1. Guard Clause: Stop immediately if no user is currently logged in
    if (!state.user) return;

    try {
        // 2. HTTP POST Request: Tell the backend API to mark all notifications as read for this user
        await fetch(`${API_BASE}/notifications/mark-read?userId=${state.user.id}&role=${state.user.role}`, { method: 'POST' });

        // 3. UI Refresh: Re-fetch notifications so the badge and dropdown update instantly on the screen
        await fetchNotifications();

    } catch (_) {
        /* Fail Silently: Catch network issues so the UI doesn't crash if the request fails */
    }

}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    const bell = document.getElementById('notifBellBtn');
    const dropdown = document.getElementById('notifDropdown');
    if (bell && dropdown && !bell.contains(e.target) && !dropdown.contains(e.target)) {
        _notifDropdownOpen = false;
        dropdown.style.display = 'none';
    }
});

// ================= STUDENT WORKSPACE FLOW =================

async function renderStudentDashboard() {
    // TODO: Team Member 2 - Load student-assigned quizzes and mistake banks, rendering status buttons based on submission records.
    alert("TODO: Team Member 2 - Implement renderStudentDashboard in app.js");
}

async function loadQuestionsForExam() {
    // TODO: Team Member 2 - Load active quiz configuration details and initialize questions list layout.
    alert("TODO: Team Member 2 - Implement loadQuestionsForExam in app.js");
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
                    placeholder="// Type your response code logic payload here...">${savedAns}</textarea>
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
                Submit Responses & Continue ▶
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

//Toggle flag on a question card
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
            const val = document.getElementById(`active-student-essay-${q.id}`).value;
            state.studentAnswers[q.id] = val;
        }
    });

    switchLocalPanel('screen-student-exam');
    switchLocalPanel('screen-student-survey');

    const surveyContainer = document.getElementById('studentSurveyQuestionsRepetitionArea');
    if (!surveyContainer) return;
    surveyContainer.innerHTML = "";

    state.questions.forEach((q, idx) => {
        const studentAns = state.studentAnswers[q.id] || "No response recorded.";

        let blockHTML = `
            <div class="glass-card mb-4" style="background-color: #ffffff; border: 1px solid var(--border-color);">`;
        if (state.quizMode === "PDF") {
            blockHTML += `<h5 class="fw-bold text-dark mb-3">Question #${idx + 1} (${q.type})</h5>`;
        } else {
            blockHTML += `<h5 class="fw-bold text-dark mb-3">Question #${idx + 1}: ${q.prompt}</h5>`;
        }
        blockHTML += `
                <div class="p-2 border rounded font-monospace small mb-3" style="border-color: var(--border-color) !important; color: var(--accent-indigo) !important; background-color: #f8fafc;">
                    <strong>[Student Output Data]:</strong> ${studentAns}
                </div>
                <div class="mt-3">
                    <label class="form-label small fw-bold text-dark d-block">Rate cognitive complexity/difficulty for Question #${idx + 1}:</label>
                    <div class="survey-emoji-group">
                        <div class="emoji-btn" id="emoji-easy-${q.id}" data-val="Easy" onclick="selectSurveyDifficulty(${q.id}, 'Easy')">
                            😊 <span>Easy</span>
                        </div>
                        <div class="emoji-btn selected" id="emoji-medium-${q.id}" data-val="Medium" onclick="selectSurveyDifficulty(${q.id}, 'Medium')">
                            😐 <span>Medium</span>
                        </div>
                        <div class="emoji-btn" id="emoji-hard-${q.id}" data-val="Hard" onclick="selectSurveyDifficulty(${q.id}, 'Hard')">
                            🤯 <span>Hard</span>
                        </div>
                    </div>
                    <div class="mt-3">
                        <label class="form-label small fw-bold text-dark d-block">Explain any pain points or roadblocks:</label>
                        <input type="text" class="form-control form-control-sm" id="survey-note-node-${q.id}" placeholder="e.g. Struggled mapping text abstraction layers..." oninput="updateCharCount(this, ${q.id})">
                        <div class="text-end text-secondary small mt-1" style="font-size: 11px;"><span id="survey-char-count-${q.id}">0</span>/200 chars</div>
                    </div>
                </div>
            </div>`;

        state.studentSurvey[q.id] = { difficulty: "Medium", note: "" };
        surveyContainer.innerHTML += blockHTML;
    });
}

function selectSurveyDifficulty(qId, level) {
    const opts = ['Easy', 'Medium', 'Hard'];
    opts.forEach(o => {
        const btn = document.getElementById(`emoji-${o.toLowerCase()}-${qId}`);
        if (btn) btn.classList.remove('selected');
    });

    const selectedBtn = document.getElementById(`emoji-${level.toLowerCase()}-${qId}`);
    if (selectedBtn) selectedBtn.classList.add('selected');

    if (!state.studentSurvey[qId]) state.studentSurvey[qId] = {};
    state.studentSurvey[qId].difficulty = level;
}



function updateCharCount(input, qId) {
    if (input.value.length > 200) {
        input.value = input.value.substring(0, 200);
    }
    document.getElementById(`survey-char-count-${qId}`).innerText = input.value.length;
}

async function completeSurveyPipeline() {
    // TODO: Team Member 2 - Collect exam answer responses and reflections, submitting payloads to exam & survey endpoints.
    alert("TODO: Team Member 2 - Implement completeSurveyPipeline in app.js");
}

// ================= STUDENT MISTAKE BANK =================

function onMistakeQuizDropdownChange(val) {
    state.selectedQuizTitle = val;
    const newUrl = window.location.pathname + '?quizTitle=' + encodeURIComponent(val);
    window.history.pushState({ path: newUrl }, '', newUrl);
    openStudentMistakeBankWithReload();
}


async function openStudentMistakeBankWithReload() {
    // TODO: Team Member 2 - Query student evaluation logs for active mistake checks, compiling correct/incorrect answer states.
    alert("TODO: Team Member 2 - Implement openStudentMistakeBankWithReload in app.js");
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

// Member Han  - Student dispute ticketing and private chat operations
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
    // TODO: Team Member 5 - Load and render private dispute comments streams and audit buttons inside student logs.
    alert("TODO: Team Member 5 - Implement renderStudentEmbeddedPrivateChatArea in app.js");
}

async function dispatchStudentEmbeddedChat(qId) {
    // TODO: Team Member 5 - Send message from student inside embedded private chat channel.
    alert("TODO: Team Member 5 - Implement dispatchStudentEmbeddedChat in app.js");
}



// Sidebar quiz list and selection operations
//Member 1-Han: Load quizzes list from API, render sidebar buttons, and handle quiz selection state.
async function loadQuizzesSidebar() {
    // 1. DOM Check: Grab the container element where the sidebar quiz list should live
    const sidebar = document.getElementById('quizListSidebarContainer');
    if (!sidebar) return; // Guard clause: Stop if the sidebar container isn't on the current page

    try {
        // 2. Fetch Data: Call the API to get all available quizzes from the server
        const res = await fetch(`${API_BASE}/questions/quizzes`);
        if (!res.ok) throw new Error("Failed to fetch quizzes list.");

        // 3. Global State Sync: Parse JSON data and store it in the global 'state' object
        state.quizzes = await res.json();

        // 4. Empty State Handling: If there are no quizzes available, show a fallback message
        if (state.quizzes.length === 0) {
            sidebar.innerHTML = `<div class="text-center py-3 text-secondary small">No quizzes published.</div>`;
            return;
        }

        // 5. Default Selection: If no quiz is currently active, auto-select the very first quiz in the array
        if (!state.selectedQuizTitle && state.quizzes.length > 0) {
            state.selectedQuizTitle = state.quizzes[0].Title || state.quizzes[0].title;
        }

        // 6. UI Render Loop: Clear out old content, then dynamically create a button for each quiz
        sidebar.innerHTML = "";
        state.quizzes.forEach(quiz => {
            // Handles potential naming differences from the backend (PascalCase vs camelCase)
            const title = quiz.title || quiz.Title;
            const isSelected = state.selectedQuizTitle === title;

            // Create a button element and apply styles dynamically based on selection state
            const btn = document.createElement('button');
            btn.className = `btn btn-sm text-start p-2.5 rounded border border-secondary border-opacity-15 w-100 d-flex flex-column gap-1 transition-all`;
            btn.style.backgroundColor = isSelected ? "var(--accent-indigo)" : "#ffffff";
            btn.style.color = isSelected ? "#ffffff" : "var(--text-color)";

            // Inject internal layout: quiz title and structural metadata (points, mode)
            btn.innerHTML = `
                <strong class="small text-wrap d-block text-start" style="font-size:12px; line-height:1.2; font-weight:600;">${title}</strong>
                <span class="small opacity-75 d-block text-start" style="font-size: 10px; margin-top:2px;">Points: ${quiz.totalScore || quiz.TotalScore} pts | Mode: ${quiz.quizMode || quiz.QuizMode}</span>
            `;

            // 7. Interaction: Add click listener to switch to this specific quiz when clicked
            btn.onclick = () => {
                selectQuizFromSidebar(title);
            };

            // Append the finished button element to the sidebar container
            sidebar.appendChild(btn);
        });
    } catch (err) {
        // 8. Error Handling: Update the UI with a clean warning banner if the network request fails
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


// Member Han  - Load question diagnostics for the active quiz,
//compiling student feedback difficulty counts and flagging potential anomaly rating discrepancies.

async function loadQuestionDiagnostics() {
    const container = document.getElementById('analyticsQuestionDiagnosticsContainer');
    if (!container) return;

    try {
        const titleQuery = state.selectedQuizTitle ? `&quizTitle=${encodeURIComponent(state.selectedQuizTitle)}` : "";
        const resSub = await fetch(`${API_BASE}/instructor/roster?subTab=all${titleQuery}`);
        if (!resSub.ok) throw new Error();
        const submissions = await resSub.json();

        if (!state.questions || state.questions.length === 0) {
            container.innerHTML = `<div class="text-center text-secondary py-3 small">No questions have been published.</div>`;
            return;
        }

        let html = "";
        state.questions.forEach((q, qIdx) => {
            let totalAnswers = 0;
            let correctAnswers = 0;
            let easyCount = 0;
            let mediumCount = 0;
            let hardCount = 0;
            let anomalies = [];

            submissions.forEach(sub => {
                const ans = sub.answers.find(a => a.questionId === q.id);
                if (ans && ans.studentAnswer) {
                    totalAnswers++;
                    if (ans.isCorrect === true) {
                        correctAnswers++;
                    }
                    if (ans.difficulty === 'Easy') easyCount++;
                    else if (ans.difficulty === 'Medium') mediumCount++;
                    else if (ans.difficulty === 'Hard') hardCount++;

                    // Flag rating anomalies: scored high but rated "Hard"
                    if (ans.isCorrect === true && ans.difficulty === 'Hard') {
                        anomalies.push({
                            studentName: sub.studentName,
                            studentId: sub.studentId,
                            note: ans.commentNote || "No reflection notes logged."
                        });
                    }
                }
            });

            const successRate = totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0;
            const easyPct = totalAnswers > 0 ? Math.round((easyCount / totalAnswers) * 100) : 0;
            const medPct = totalAnswers > 0 ? Math.round((mediumCount / totalAnswers) * 100) : 0;
            const hardPct = totalAnswers > 0 ? Math.round((hardCount / totalAnswers) * 100) : 0;

            let anomaliesHTML = "";
            if (anomalies.length > 0) {
                anomaliesHTML += `
                    <div class="mt-3 p-3 border border-danger rounded bg-danger-subtle" style="background-color: rgba(239, 68, 68, 0.05); border-color: rgba(239, 68, 68, 0.25) !important;">
                        <h6 class="text-danger fw-bold small mb-2 d-flex align-items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                            Flagged Survey Discrepancy Warnings (${anomalies.length}):
                        </h6>
                        <ul class="mb-0 ps-3 text-danger small">
                            ${anomalies.map(a => `
                                <li class="mb-1">
                                    <strong>${a.studentName} (${a.studentId})</strong> scored 100% correct but rated this task as <strong>"Hard"</strong>. 
                                    <br><span class="text-secondary italic">Survey Reflection Note: "${a.note}"</span>
                                </li>`).join('')}
                        </ul>
                    </div>`;
            } else {
                anomaliesHTML += `
                    <div class="mt-3 p-2 border border-success rounded bg-success-subtle text-success small d-flex align-items-center gap-2" style="background-color: rgba(16, 185, 129, 0.05); border-color: rgba(16, 185, 129, 0.25) !important;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        No rating anomalies identified. All responses align with cognitive ratings.
                    </div>`;
            }

            html += `
                <div class="p-3 border rounded bg-white mb-3" style="border-color: var(--border-color) !important;">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <div>
                            <span class="badge-custom badge-custom-cyan mb-1 d-inline-block">Question #${qIdx + 1} | Topic: ${q.topic || 'General'}</span>
                            <h6 class="fw-bold text-dark small mb-0">${q.prompt}</h6>
                        </div>
                        <div class="text-end">
                            <span class="text-secondary small d-block" style="font-size: 11px;">SUCCESS RATE</span>
                            <strong class="text-cyan font-monospace small" style="font-size: 14px;">${successRate}% (${correctAnswers}/${totalAnswers} Correct)</strong>
                        </div>
                    </div>

                    <div class="row g-2 mt-2">
                        <div class="col-md-4">
                            <div class="p-2 border rounded bg-light text-center small">
                                <span class="d-block text-secondary" style="font-size: 11px;">😊 Easy Rating</span>
                                <strong class="text-emerald">${easyPct}%</strong> <span class="text-secondary">(${easyCount})</span>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="p-2 border rounded bg-light text-center small">
                                <span class="d-block text-secondary" style="font-size: 11px;">😐 Medium Rating</span>
                                <strong class="text-cyan">${medPct}%</strong> <span class="text-secondary">(${mediumCount})</span>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="p-2 border rounded bg-light text-center small">
                                <span class="d-block text-secondary" style="font-size: 11px;">🤯 Hard Rating</span>
                                <strong class="text-rose">${hardPct}%</strong> <span class="text-secondary">(${hardCount})</span>
                            </div>
                        </div>
                    </div>

                    ${anomaliesHTML}
                </div>`;
        });

        container.innerHTML = html;
    } catch (err) {
        container.innerHTML = `<div class="alert-custom alert-custom-warning small">Error loading diagnostics dataset.</div>`;
    }
}


//Member 1-Han: Load question list for the active quiz, rendering inline edit cards with answer key mutation capabilities.
async function renderInlineQuestionEditSection() {
    // 1. DOM Check: Grab the UI section and container where the question management UI will render
    const section = document.getElementById('instructorPerQuestionInlineEditSection');
    const container = document.getElementById('inlineQuestionEditContainer');
    if (!section || !container) return; // Guard clause: Abort if these elements do not exist on the current page

    try {
        // 2. Fetch Data: Retrieve the list of quiz questions from the backend API
        const res = await fetch(`${API_BASE}/questions`);
        if (!res.ok) return; // Stop if the network response is an error status code
        const data = await res.json();

        // 3. UI Setup: Make the main section wrapper visible and clear out any stale HTML content
        section.style.display = "block";
        container.innerHTML = "";

        // 4. Data Processing & Render: Loop through every retrieved question
        data.questions.forEach(q => {
            // Check if the question type is Multiple Choice Question (MCQ)
            if (q.type === "MCQ") {
                // Inject an inline edit tool that lets an instructor quickly swap the correct answer key
                // Note: The conditional ternary operator (${q.correctKey === 'X' ? 'selected' : ''}) keeps the current correct option selected by default
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
        // 5. Error Catching: Log any unexpected runtime/network errors directly to the developer console
        console.error(err);
    }
}





// Member Han  - Inline answer key mutation for MCQ questions, triggering class-wide auto-regrading.
async function inlineModifyAnswerKey(qId, val) {
    try {
        // 1. Setup Payload: Package the target question ID and the newly selected correct answer option
        const payload = { questionId: qId, correctKey: val };

        // 2. HTTP Request: Send the updated key to the backend API endpoint using a POST method
        const res = await fetch(`${API_BASE}/instructor/update-answer-key`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        // 3. Error Checking: If the server returns an unstable response status, drop to the catch block
        if (!res.ok) throw new Error("Could not update key.");

        // 4. Success Alert: Notify the instructor that the core database record and student scoring balances are altered
        alert(`Answer key successfully mutated in database. All student scores re-calculated.`);

        // 5. UI Synchronization: Trigger dashboard component reloads to display modified metrics instantly
        loadInstructorAnalytics();
        switchRosterSubTab(state.activeRosterSubTab);

    } catch (err) {
        // 6. Exception Handling: Catch connection issues or system validation rejections smoothly
        alert(err.message);
    }
}




async function switchRosterSubTab(subTab) {
    // TODO: Team Member 3 - Mutate active sub-tab view contexts and initiate roster table content refresh.
    alert("TODO: Team Member 3 - Implement switchRosterSubTab in app.js");
}

async function renderMultiStudentRosterTable() {
    // TODO: Team Member 3 - Retrieve student roster summaries filtered by tab parameters and render table rows.
    alert("TODO: Team Member 3 - Implement renderMultiStudentRosterTable in app.js");
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



// Member 1-Han: Compile form builder inputs, validate question configurations, and submit new quiz task to server for publication.
async function instructorPublishTask() {
    // 1. Initial Validation: Check if Title is provided and Total Score is a positive number
    const titleVal = document.getElementById('inputTaskTitle').value;
    if (!titleVal) return alert("Assignment title is required.");

    const totalScoreVal = parseFloat(document.getElementById('inputQuizTotalScore').value);
    if (isNaN(totalScoreVal) || totalScoreVal <= 0) {
        return alert("Total Score must be a positive number.");
    }

    // 2. Mode Check: If the instructor selected "PDF" exam mode, make sure a file was actually uploaded
    if (state.quizMode === "PDF" && !state.pdfBase64) {
        return alert("A PDF document must be uploaded in PDF Exam mode.");
    }

    // 3. Container Validation: Make sure the teacher has added at least one question card to the list
    let questionsPayload = [];
    const container = document.getElementById('custom-questions-list-container');
    if (!container || container.children.length === 0) {
        return alert("Please add at least one question to publish.");
    }

    let hasError = false;
    let sumWeights = 0.0;

    // 4. Processing Loop: Read each individual question card from the UI list
    Array.from(container.children).forEach((card, idx) => {
        const type = card.getAttribute('data-type'); // 'MCQ' or 'Essay'
        const topic = card.querySelector('.custom-q-topic').value.trim() || "General";
        const scoreInput = card.querySelector('.custom-q-score');
        const maxScore = scoreInput ? parseFloat(scoreInput.value) || 0.0 : 0.0;
        sumWeights += maxScore; // Keep a running total of question points

        let prompt = "";

        // Define prompt text depending on whether it's a structural PDF placeholder or manual entry
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

        // Process Multiple Choice Questions (MCQ)
        if (type === 'MCQ') {
            let optA = "Option A";
            let optB = "Option B";
            let optC = "Option C";
            let optD = "Option D";
            const key = card.querySelector('.custom-q-key').value;

            // Gather values for options A-D if manually writing questions
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

            // Append structured MCQ data to our payload array
            questionsPayload.push({
                type: "MCQ",
                topic: topic,
                prompt: prompt,
                options: [`A. ${optA}`, `B. ${optB}`, `C. ${optC}`, `D. ${optD}`],
                correctKey: key,
                maxScore: maxScore
            });
        } else {
            // Process and append Essay questions to our payload array
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

    // 5. Data Integrity Validation: Ensure total score exactly equals sum of individual question values
    // Uses Math.abs subtraction to safely handle small JavaScript decimal floating-point inaccuracies
    if (Math.abs(sumWeights - totalScoreVal) > 0.001) {
        return alert(`Validation Failure: The sum of question weights (${sumWeights.toFixed(1)}) must exactly equal the Total Score (${totalScoreVal.toFixed(1)}).`);
    }

    // 6. Metadata Gathering: Retrieve supporting configurations from the DOM
    const timeLimitVal = parseInt(document.getElementById('inputQuizTimeLimit').value) || 40;
    const deadlineVal = document.getElementById('inputQuizDeadline').value || null;
    const isQuizOpenVal = document.getElementById('inputIsQuizOpen').checked;
    const isForumOpenVal = document.getElementById('inputIsForumOpen').checked;

    try {
        // Construct complete database packaging payload
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

        // 7. Network Request: Send unified package to the backend API via HTTP POST
        const res = await fetch(`${API_BASE}/questions/publish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Failed to publish assessment.");

        alert("✔ New assessment successfully generated and active configurations updated!");

        // 8. State Refresh: Fetch newly stored information back down to sync the application context
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

        // 9. Redirect view tab to analytics view upon successful creation
        switchTeacherTab('analytics');
    } catch (err) {
        alert(err.message);
    }
}






// ================= INSTRUCTOR GRADING DESK FLOW =================

async function routeTargetStudentToEvaluationDesk(studentId) {
    // TODO: Team Member 4 - Load student submission and reflection logs, verifying automated crosscheck warnings.
    alert("TODO: Team Member 4 - Implement routeTargetStudentToEvaluationDesk in app.js");
}

async function loadInstructorGrowCards(answers = null) {
    // TODO: Team Member 4 - Fetch templates configuration and build select feedback buttons for grading cards.
    alert("TODO: Team Member 4 - Implement loadInstructorGrowCards in app.js");
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
    // TODO: Team Member 4 - Post new custom feedback error tag template to database list and refresh banks.
    alert("TODO: Team Member 4 - Implement generateGrowCardActionForQuestion in app.js");
}

async function instructorSubmitEvaluation() {
    // TODO: Team Member 4 - Compile allocated scores and feedback tags from grading panels, sending grades to commit endpoint.
    alert("TODO: Team Member 4 - Implement instructorSubmitEvaluation in app.js");
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
    // TODO: Team Member 5 - Send message from teacher inside private dispute chat workspace.
    alert("TODO: Team Member 5 - Implement dispatchInstructorEmbeddedChat in app.js");
}

async function executeInstructorManualScoreOverride(studentId, qId, isApproved) {
    // TODO: Team Member 5 - Submit dispute audits and score override points registries.
    alert("TODO: Team Member 5 - Implement executeInstructorManualScoreOverride in app.js");
}

// ================= COURSE FORUM SYSTEM =================

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
    // TODO: Team Member 5 - Load current forum active channels list and configure topic categories.
    alert("TODO: Team Member 5 - Implement initializeForumPage in app.js");
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


// Toggle accordion section and lazy-load chat
function toggleForumAccordion(idx, topic) {
    const chatEl   = document.getElementById(`forum-chat-${idx}`);
    const arrowEl  = document.getElementById(`accord-arrow-${idx}`);
    const headerEl = chatEl ? chatEl.previousElementSibling : null;

    if (!chatEl) return;
    const isOpen = chatEl.style.display !== 'none';

    if (isOpen) {
        chatEl.style.display = 'none';
        if (arrowEl) arrowEl.style.transform = 'rotate(0deg)';
        if (headerEl) headerEl.style.background = '#fafafa';
    } else {
        chatEl.style.display = 'block';
        if (arrowEl) arrowEl.style.transform = 'rotate(180deg)';
        if (headerEl) headerEl.style.background = 'rgba(99,102,241,0.07)';
        // Lazy-load chat if empty
        if (!chatEl.innerHTML.trim()) {
            renderUnifiedForumComponent(`forum-chat-${idx}`, topic);
        }
    }
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

        const uniqueTopics = new Set();
        dataQ.questions.forEach(q => { if (q.topic) uniqueTopics.add(q.topic); });
        const topicsList = [...Array.from(uniqueTopics), "General Q&A"];

        // Reuse accordion renderer — pass the standalone container ID
        renderTeacherForumInterface(topicsList, 'standalone-teacher-forum-container');
    } catch (err) {
        container.innerHTML = `<div class="alert-custom alert-custom-warning small">Error loading forum rooms: ${err.message}</div>`;
    }
}

// targetContainerId: 'student-forum-container-target' (on /Forum page) or 'standalone-teacher-forum-container' (dashboard)
function renderTeacherForumInterface(topicsList, targetContainerId = 'student-forum-container-target') {
    const container = document.getElementById(targetContainerId);
    if (!container) return;

    let accordionHTML = '';
    topicsList.forEach((topic, idx) => {
        const isOpen = idx === 0;
        const isGeneral = topic === 'General Q&A';
        const icon = isGeneral ? '&#x1F4AC;' : '&#x1F4DA;';
        const safeTopic = topic.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        const chatId  = `forum-chat-${idx}`;
        const uploadId = `forum-upload-panel-${idx}`;

        accordionHTML += `
            <div class="forum-accordion-item" style="border:1px solid var(--border-color); border-radius:10px; margin-bottom:8px; overflow:hidden;">
                <!-- Header -->
                <div class="forum-accordion-header d-flex align-items-center justify-content-between px-3 py-3"
                     style="cursor:pointer; background:${isOpen ? 'rgba(99,102,241,0.07)' : '#fafafa'}; transition:background 0.2s;">
                    <span class="fw-semibold small" onclick="toggleForumAccordion(${idx}, '${safeTopic}')" style="flex:1;">
                        ${icon} ${topic}
                    </span>
                    <div class="d-flex align-items-center gap-2">
                        <!-- Upload material button (teacher only) -->
                        <button onclick="event.stopPropagation(); teacherToggleUpload('${uploadId}')" title="Post study material for this topic"
                            style="background:rgba(99,102,241,0.1); border:1px solid rgba(99,102,241,0.25); border-radius:6px; padding:3px 8px; font-size:11px; color:var(--accent-indigo); cursor:pointer; font-weight:600;">
                            &#x1F4CE; Material
                        </button>
                        <svg id="accord-arrow-${idx}" onclick="toggleForumAccordion(${idx}, '${safeTopic}')" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
                             style="transition:transform 0.2s; transform:${isOpen ? 'rotate(180deg)' : 'rotate(0deg)'}; color:#94a3b8; cursor:pointer;">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </div>
                </div>

                <!-- Upload material panel (hidden by default) -->
                <div id="${uploadId}" style="display:none; background:#f0f4ff; border-bottom:1px solid var(--border-color); padding:12px 16px;">
                    <p class="small fw-semibold text-dark mb-2" style="font-size:12px;">&#x1F4CE; Post Study Material for <em>${topic}</em></p>
                    <div class="d-flex gap-2 flex-wrap">
                        <input type="text" id="${uploadId}-title" placeholder="Material title (e.g. Lecture 3 Notes)" class="form-control form-control-sm" style="flex:1; min-width:160px;">
                        <input type="text" id="${uploadId}-url"   placeholder="URL or description" class="form-control form-control-sm" style="flex:2; min-width:200px;">
                        <button onclick="teacherSubmitMaterial('${uploadId}', '${safeTopic}')" class="btn btn-sm btn-dark-custom" style="white-space:nowrap;">Post &#x2192;</button>
                    </div>
                </div>

                <!-- Chat body (lazy loaded) -->
                <div id="${chatId}" style="display:${isOpen ? 'block' : 'none'};">
                </div>
            </div>`;
    });

    container.innerHTML = `
        <div class="glass-panel">
            <h4 class="fw-bold text-dark mb-1" style="font-family: var(--font-heading);">&#x1F4AC; Course Forums Moderation</h4>
            <p class="text-secondary small mb-1">${state.activeTaskTitle}</p>
            <p class="text-secondary small mb-4" style="font-size:12px;">Expand a topic to view discussions &amp; post study materials. Topics load on demand.</p>
            <div id="forum-accordion-container">${accordionHTML}</div>
        </div>`;

    // Auto-load first topic
    if (topicsList.length > 0) {
        renderUnifiedForumComponent('forum-chat-0', topicsList[0]);
    }
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
    // TODO: Team Member 5 - Query forum comments for specific topics and render scroll streams.
    alert("TODO: Team Member 5 - Implement renderUnifiedForumComponent in app.js");
}

async function dispatchLiveCommentSubmission(targetContainerID, filterTopic) {
    // TODO: Team Member 5 - Post new comments to forum streams and update layouts.
    alert("TODO: Team Member 5 - Implement dispatchLiveCommentSubmission in app.js");
}

// Page-based router initialization on DOM Load
window.addEventListener('DOMContentLoaded', async () => {
    // Restore session from localStorage if exists
    const savedUser = localStorage.getItem('caselab_user');
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
        pdfInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;
            if (file.type !== "application/pdf") {
                alert("Please select a valid PDF file.");
                e.target.value = "";
                return;
            }
            const reader = new FileReader();
            reader.onload = function(evt) {
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
