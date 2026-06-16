// CaseLabBase - Client Script (app.js)
const API_BASE = "http://localhost:5088/api";

let state = {
    user: null, // Logged-in user DTO { id, name, role }
    activeTaskTitle: "Quiz 1: Elementary Math Basics",
    activeSelectedPresetOption: 1,
    activeRosterSubTab: "pending",
    
    questions: [], // Active questions retrieved from API
    studentAnswers: {}, // Student's typed responses
    studentSurvey: {}, // Survey ratings and notes
    flaggedQuestions: {}, // Questions flagged by student to revisit
    
    errorTags: [], // Grow-As-You-Go error tag templates
    chosenTag: null, // Error tag selected during grading
    activeGradingStudentID: null, // Student currently being evaluated
    
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
        const cleanStr = state.deadlineString.replace('T', ' ');
        const deadline = new Date(cleanStr);
        if (new Date() > deadline) return false;
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
    // TODO: Team Member 1 - Post credentials to auth login API and route session user to their dashboard.
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

let _notifDropdownOpen = false;

async function fetchNotifications() {
    // TODO: Team Member 1 - Fetch unread notifications from /api/notifications and populate the dropdown badge.
    alert("TODO: Team Member 1 - Implement fetchNotifications in app.js");
}

function toggleNotifDropdown() {
    const dropdown = document.getElementById('notifDropdown');
    if (!dropdown) return;
    _notifDropdownOpen = !_notifDropdownOpen;
    dropdown.style.display = _notifDropdownOpen ? 'block' : 'none';
    if (_notifDropdownOpen) fetchNotifications();
}

async function markAllNotifsRead() {
    // TODO: Team Member 1 - Send POST request to notification mark-read endpoint and refresh current feed state.
    alert("TODO: Team Member 1 - Implement markAllNotifsRead in app.js");
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
                <div class="glass-panel d-flex flex-column gap-3" style="max-height: 650px; overflow-y: auto; border-color: var(--border-color) !important; padding-right: 5px;">
                    <h5 class="fw-bold text-dark border-bottom pb-2 mb-2" style="font-family: var(--font-heading);">✏️ Enter Exam Responses Below:</h5>
                    <div id="studentActiveQuestionsArea"></div>
                    <div class="mt-2">
                        <button class="btn btn-dark-custom btn-lg w-100 py-3 fw-bold" onclick="lockExamAndOpenSurvey()">
                            Submit Responses & Proceed to Survey
                        </button>
                    </div>
                </div>
            </div>`;
    } else {
        layoutArea.innerHTML = `
            <div class="col-lg-9 mx-auto">
                <div class="glass-panel">
                    <div id="studentActiveQuestionsArea"></div>
                    <div class="mt-4">
                        <button class="btn btn-dark-custom btn-lg w-100 py-3 fw-bold" onclick="lockExamAndOpenSurvey()">
                            Submit Responses & Proceed to Survey
                        </button>
                    </div>
                </div>
            </div>`;
    }

    const container = document.getElementById('studentActiveQuestionsArea');
    if (!container) return;

    // Flagged questions summary bar
    let html = `
        <div id="flaggedSummaryBar" class="d-flex align-items-center gap-2 mb-3 p-2 rounded d-none"
             style="background: #fef3c7; border: 1.5px solid #f59e0b; border-radius: 8px;">
            <span style="font-size:16px;">&#x1F6A9;</span>
            <span class="small fw-semibold text-dark">Flagged for later: <span id="flaggedCount" class="fw-bold text-amber">0</span> question(s) &mdash; <em class="text-secondary fw-normal" style="font-size:11px;">Click the flag on a question to mark it as &ldquo;hard&rdquo; and revisit.</em></span>
        </div>`;

    state.questions.forEach((q, idx) => {
        html += `<div class="glass-card mb-4" id="q-card-wrapper-${q.id}" style="border: 1.5px solid var(--border-color); transition: border-color 0.2s;">`;

        // Card header: question title + flag button
        const labelText = state.quizMode === "PDF"
            ? `Question #${idx + 1} (${q.type})`
            : `Question #${idx + 1}: ${q.prompt}`;

        html += `
            <div class="d-flex justify-content-between align-items-start mb-3">
                <h6 class="fw-bold text-dark mb-0 me-3" style="flex:1; line-height:1.4;">${labelText}</h6>
                <button id="flag-btn-${q.id}" onclick="toggleFlagQuestion(${q.id})"
                    title="Flag this question to revisit later"
                    class="btn p-0 d-flex align-items-center justify-content-center flex-shrink-0"
                    style="width:30px; height:30px; background:transparent; border:1.5px solid #e2e8f0; border-radius:6px; font-size:14px; color:#94a3b8; transition:all 0.2s;">
                    &#x1F3F3;
                </button>
            </div>`;

        if (q.type === "MCQ") {
            html += `<div class="d-flex flex-column">`;
            if (state.quizMode === "PDF") {
                ['A', 'B', 'C', 'D'].forEach(optKey => {
                    html += `
                        <div class="mcq-option-card" id="mcq-card-${q.id}-${optKey}" onclick="selectStudentMCQOption(${q.id}, '${optKey}')">
                            <div class="mcq-radio-dot" id="mcq-dot-${q.id}-${optKey}"></div>
                            <span class="small">Option ${optKey}</span>
                        </div>`;
                });
            } else {
                q.options.forEach(opt => {
                    const optKey = opt.trim().substring(0, 1);
                    html += `
                        <div class="mcq-option-card" id="mcq-card-${q.id}-${optKey}" onclick="selectStudentMCQOption(${q.id}, '${optKey}')">
                            <div class="mcq-radio-dot" id="mcq-dot-${q.id}-${optKey}"></div>
                            <span class="small">${opt}</span>
                        </div>`;
                });
            }
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
                    <textarea class="form-control code-input" id="active-student-essay-${q.id}" rows="3" placeholder="// Type your response code logic payload here..."></textarea>
                </div>`;
        }

        html += `</div>`;
    });

    container.innerHTML = html;
}

// Toggle flag on a question card
function toggleFlagQuestion(qId) {
    state.flaggedQuestions[qId] = !state.flaggedQuestions[qId];
    const isFlagged = state.flaggedQuestions[qId];

    const card = document.getElementById(`q-card-wrapper-${qId}`);
    const btn  = document.getElementById(`flag-btn-${qId}`);

    if (card) {
        card.style.borderColor = isFlagged ? '#f59e0b' : 'var(--border-color)';
        card.style.borderWidth  = isFlagged ? '2px' : '1.5px';
    }
    if (btn) {
        btn.innerHTML = isFlagged ? '&#x1F6A9;' : '&#x1F3F3;';
        btn.style.color         = isFlagged ? '#f59e0b' : '#94a3b8';
        btn.style.borderColor   = isFlagged ? '#f59e0b' : '#e2e8f0';
    }

    // Update summary bar
    const count = Object.values(state.flaggedQuestions).filter(Boolean).length;
    const bar   = document.getElementById('flaggedSummaryBar');
    const countEl = document.getElementById('flaggedCount');
    if (countEl) countEl.innerText = count;
    if (bar) bar.classList.toggle('d-none', count === 0);
}

function selectStudentMCQOption(qId, key) {
    const q = state.questions.find(quest => quest.id === qId);
    if (!q) return;

    q.options.forEach(opt => {
        const k = opt.trim().substring(0, 1);
        const card = document.getElementById(`mcq-card-${qId}-${k}`);
        if (card) card.classList.remove('selected');
    });

    const selectedCard = document.getElementById(`mcq-card-${qId}-${key}`);
    if (selectedCard) selectedCard.classList.add('selected');

    state.studentAnswers[qId] = key;
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

async function openStudentMistakeBankWithReload() {
    // TODO: Team Member 2 - Query student evaluation logs for active mistake checks, compiling correct/incorrect answer states.
    alert("TODO: Team Member 2 - Implement openStudentMistakeBankWithReload in app.js");
}

async function initiateStudentDisputeTicket(qId) {
    // TODO: Team Member 5 - Prompt student reason statement, opens private dispute thread, and posts start comment.
    alert("TODO: Team Member 5 - Implement initiateStudentDisputeTicket in app.js");
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
async function loadQuizzesSidebar() {
    // TODO: Team Member 1 - Retrieve active quizzes list, handle sidebar navigation, and bind event selection triggers.
    alert("TODO: Team Member 1 - Implement loadQuizzesSidebar in app.js");
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

    await loadQuizzesSidebar();
    await loadInstructorAnalytics();
    await switchRosterSubTab(state.activeRosterSubTab);
}

// ================= INSTRUCTOR DASHBOARD FLOW =================

async function switchTeacherTab(tab) {
    document.querySelectorAll('.teacher-tab-content').forEach(c => c.classList.add('d-none'));
    document.querySelectorAll('#teacherTabs .nav-link-custom').forEach(l => l.classList.remove('active'));
    
    document.getElementById(`teacher-tab-${tab}`).classList.remove('d-none');
    document.getElementById(`tab-btn-${tab}`).classList.add('active');
    
    if (tab === 'manager') {
        // Pre-populate global configurations
        const inputTitle = document.getElementById('inputTaskTitle');
        if (inputTitle) inputTitle.value = state.activeTaskTitle;
        const inputLimit = document.getElementById('inputQuizTimeLimit');
        if (inputLimit) inputLimit.value = state.timeLimitMinutes;
        const inputTotalScore = document.getElementById('inputQuizTotalScore');
        if (inputTotalScore) inputTotalScore.value = state.totalScore;
        const inputDeadline = document.getElementById('inputQuizDeadline');
        if (inputDeadline) inputDeadline.value = state.deadlineString ? state.deadlineString.substring(0, 16) : ""; // Convert ISO to local format YYYY-MM-DDThh:mm
        const checkQuiz = document.getElementById('inputIsQuizOpen');
        if (checkQuiz) checkQuiz.checked = state.isQuizOpen;
        const checkForum = document.getElementById('inputIsForumOpen');
        if (checkForum) checkForum.checked = state.isForumOpen;

        const inputQuizMode = document.getElementById('inputQuizMode');
        if (inputQuizMode) {
            inputQuizMode.value = state.quizMode;
        }
        const wrapper = document.getElementById('pdfUploadWrapper');
        if (wrapper) {
            if (state.quizMode === "PDF") {
                wrapper.classList.remove('d-none');
            } else {
                wrapper.classList.add('d-none');
            }
        }
        populateQuestionBuilderFromState();
        const statusLabel = document.getElementById('quizPdfStatusLabel');
        if (statusLabel) {
            statusLabel.innerText = state.pdfBase64 ? "✔ PDF document attached and active." : "No PDF document attached.";
        }
    }
    if (tab === 'analytics') {
        switchRosterSubTab(state.activeRosterSubTab);
        loadInstructorAnalytics();
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
        document.getElementById('analyticsTaskTitle').innerText = data.activeTaskTitle;
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

        if (data.totalSubmissionsCount > 0) {
            renderInlineQuestionEditSection();
        } else {
            document.getElementById('instructorPerQuestionInlineEditSection').style.display = "none";
        }
        
        await loadQuestionDiagnostics();
    } catch (err) {
        console.error(err);
    }
}

async function loadQuestionDiagnostics() {
    // TODO: Team Member 3 - Compile student feedback difficulty counts and flag potential anomaly rating discrepancies.
    alert("TODO: Team Member 3 - Implement loadQuestionDiagnostics in app.js");
}

async function renderInlineQuestionEditSection() {
    // TODO: Team Member 1 - Load questions configuration list from API to expose inline answer mutation cards.
    alert("TODO: Team Member 1 - Implement renderInlineQuestionEditSection in app.js");
}

async function inlineModifyAnswerKey(qId, val) {
    // TODO: Team Member 4 - POST answer key mutation requests, triggering class-wide auto-regrading.
    alert("TODO: Team Member 4 - Implement inlineModifyAnswerKey in app.js");
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

async function instructorPublishTask() {
    // TODO: Team Member 1 - Harvest form builder datasets, validate score weights, and publish the new quiz task to server.
    alert("TODO: Team Member 1 - Implement instructorPublishTask in app.js");
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
        const btn = document.createElement('div');
        btn.className = "error-tag-btn";
        if (selectedTag === tag) {
            btn.classList.add('selected');
        }
        btn.innerText = tag;
        btn.onclick = function() {
            selectTemplateCardForQuestion(qId, btn, tag);
        };
        group.appendChild(btn);
    });
}

function selectTemplateCardForQuestion(qId, element, tag) {
    const group = document.getElementById(`q-template-bank-${qId}`);
    if (!group) return;

    const wasSelected = element.classList.contains('selected');

    // Deselect other buttons in this group
    group.querySelectorAll('.error-tag-btn').forEach(btn => {
        btn.classList.remove('selected');
    });

    const label = document.getElementById(`selected-tag-label-${qId}`);

    if (wasSelected) {
        element.classList.remove('selected');
        if (label) {
            label.innerText = "None (Evaluating Asset as Compliant)";
        }
    } else {
        element.classList.add('selected');
        if (label) {
            label.innerText = tag;
        }
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

// Simple Q&A forum for MCQ-only quizzes (one room, no per-topic tabs)
function renderSimpleQAForum(container, quizTitle, isInstructor) {
    const headerText = isInstructor ? "Course Q&A Moderation" : "Course Q&A Forum";
    const subText = isInstructor
        ? "Students can post questions here for MCQ clarification. Answer them publicly."
        : "Post questions about this MCQ quiz. The instructor will answer here.";
    container.innerHTML = `
        <div class="glass-panel">
            <h4 class="fw-bold text-dark mb-1" style="font-family: var(--font-heading);">&#x1F4AC; ${headerText}</h4>
            <p class="text-secondary small mb-1">${quizTitle}</p>
            <p class="text-secondary small mb-4">${subText}</p>
            <div id="forum-chat-viewport"></div>
        </div>`;
    renderUnifiedForumComponent('forum-chat-viewport', 'General Q&A');
}

function renderStudentForumInterface(topicsList, defaultTopic) {
    const container = document.getElementById('student-forum-container-target');
    if (!container) return;

    let accordionHTML = '';
    topicsList.forEach((topic, idx) => {
        const isOpen = topic === defaultTopic;
        const icon = topic === 'General Q&A' ? '&#x1F4AC;' : '&#x26A0;&#xFE0F;';
        const label = topic === 'General Q&A' ? 'General Q&A' : `Review Topic: ${topic}`;
        const chatId = `forum-chat-${idx}`;
        accordionHTML += `
            <div class="forum-accordion-item" style="border:1px solid var(--border-color); border-radius:10px; margin-bottom:8px; overflow:hidden;">
                <div class="forum-accordion-header d-flex align-items-center justify-content-between px-3 py-3"
                     onclick="toggleForumAccordion(${idx}, '${topic.replace(/'/g, "\\'")}')"
                     style="cursor:pointer; background:${isOpen ? 'rgba(99,102,241,0.07)' : '#fafafa'}; transition:background 0.2s;">
                    <span class="fw-semibold small" style="color: var(--text-color);">${icon} ${label}</span>
                    <svg id="accord-arrow-${idx}" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
                         style="transition:transform 0.2s; transform:${isOpen ? 'rotate(180deg)' : 'rotate(0deg)'}; color:#94a3b8;">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </div>
                <div id="${chatId}" style="display:${isOpen ? 'block' : 'none'};">
                    <!-- Chat loads here -->
                </div>
            </div>`;
    });

    container.innerHTML = `
        <div class="glass-panel">
            <h4 class="fw-bold text-dark mb-1" style="font-family: var(--font-heading);">&#x1F4AC; Course Forums Workspace</h4>
            <p class="text-secondary small mb-1">${state.activeTaskTitle}</p>
            <p class="text-secondary small mb-4" style="font-size:12px;">You are routed to the specific topic threads for your failed questions. Click a section to expand the discussion.</p>
            <div id="forum-accordion-container">${accordionHTML}</div>
        </div>`;

    // Auto-load first topic
    const firstIdx = topicsList.indexOf(defaultTopic);
    if (firstIdx >= 0) {
        renderUnifiedForumComponent(`forum-chat-${firstIdx}`, defaultTopic);
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

function teacherToggleUpload(panelId) {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

async function teacherSubmitMaterial(panelId, topic) {
    // TODO: Team Member 5 - Post study guide hyperlinks to specific topic forums.
    alert("TODO: Team Member 5 - Implement teacherSubmitMaterial in app.js");
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
