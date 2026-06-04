// CaseLab - Client Script (app.js)
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
    if (!state.user) return;
    try {
        const res = await fetch(`${API_BASE}/notifications?userId=${state.user.id}&role=${state.user.role}`);
        if (!res.ok) return;
        const data = await res.json();

        const badge = document.getElementById('notifBadge');
        const list  = document.getElementById('notifList');
        if (!badge || !list) return;

        if (data.unreadCount > 0) {
            badge.style.display = 'block';
            badge.textContent = data.unreadCount > 9 ? '9+' : data.unreadCount;
        } else {
            badge.style.display = 'none';
        }

        if (data.notifications.length === 0) {
            list.innerHTML = '<p class="text-secondary small text-center py-4" style="margin:0;">No notifications yet</p>';
            return;
        }

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
            </div>`).join('');
    } catch (_) { /* ignore network errors silently */ }
}

function toggleNotifDropdown() {
    const dropdown = document.getElementById('notifDropdown');
    if (!dropdown) return;
    _notifDropdownOpen = !_notifDropdownOpen;
    dropdown.style.display = _notifDropdownOpen ? 'block' : 'none';
    if (_notifDropdownOpen) fetchNotifications();
}

async function markAllNotifsRead() {
    if (!state.user) return;
    try {
        await fetch(`${API_BASE}/notifications/mark-read?userId=${state.user.id}&role=${state.user.role}`, { method: 'POST' });
        await fetchNotifications();
    } catch (_) {}
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
            if (submissionStatus === "Pending") {
                statusHTML = `
                    <div class="d-flex justify-content-between align-items-center small p-3 rounded glass-card mb-3">
                        <span class="fw-semibold text-dark">${quizTitle}</span>
                        <span class="badge-custom badge-custom-amber">✔ Submitted. Awaiting Grading.</span>
                    </div>`;
            } else if (submissionStatus === "Graded") {
                const mistakeBankLink = `/Student/MistakeBank?quizTitle=${encodeURIComponent(quizTitle)}`;
                statusHTML = `
                    <div class="d-flex justify-content-between align-items-center small p-3 rounded glass-card mb-3">
                        <div class="d-flex flex-column">
                            <span class="fw-semibold text-dark">${quizTitle}</span>
                            <span class="text-secondary small mt-1">Score: ${finalScore} / ${quiz.totalScore || quiz.TotalScore} pts</span>
                        </div>
                        <div class="d-flex gap-2">
                            ${badgeCount > 0 ? `<button class="btn btn-danger btn-sm px-3" onclick="window.location.href='${mistakeBankLink}'">View Mistakes</button>` : `<button class="btn btn-outline-success btn-sm px-3" onclick="window.location.href='${mistakeBankLink}'">Review Passed</button>`}
                        </div>
                    </div>`;
            } else {
                let isOpen = quiz.isQuizOpen || quiz.IsQuizOpen;
                const dl = quiz.deadlineString || quiz.DeadlineString;
                if (dl) {
                    const cleanStr = dl.replace('T', ' ');
                    const deadline = new Date(cleanStr);
                    if (new Date() > deadline) isOpen = false;
                }

                if (!isOpen) {
                    statusHTML = `
                        <div class="d-flex justify-content-between align-items-center p-3 rounded glass-card mb-3">
                            <div>
                                <strong class="text-dark d-block">${quizTitle}</strong>
                                <span class="text-secondary small">This assessment is currently closed or has passed its deadline.</span>
                            </div>
                            <button class="btn btn-secondary btn-sm px-4" disabled>Closed</button>
                        </div>`;
                } else {
                    statusHTML = `
                        <div class="d-flex justify-content-between align-items-center p-3 rounded glass-card mb-3">
                            <div>
                                <strong class="text-dark d-block">${quizTitle}</strong>
                                <span class="text-secondary small">Time Allowed: ${quiz.timeLimitMinutes || quiz.TimeLimitMinutes} Minutes</span>
                            </div>
                            <button class="btn btn-dark-custom btn-sm px-4" onclick="window.location.href='/Student/Exam?quizTitle=${encodeURIComponent(quizTitle)}'">Execute Form Task</button>
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
    state.questions.forEach(q => {
        const noteVal = document.getElementById(`survey-note-node-${q.id}`).value || "";
        state.studentSurvey[q.id].note = noteVal;
    });

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
            } catch (_) { /* ignore parse errors */ }
            throw new Error(`Exam submit failed: ${errMsg}`);
        }

        const surveyPayload = {
            studentId: state.user.id,
            quizTitle: state.activeTaskTitle,
            reflections: Object.keys(state.studentSurvey).map(qid => ({
                questionId: parseInt(qid),
                difficulty: state.studentSurvey[qid].difficulty,
                commentNote: state.studentSurvey[qid].note
            }))
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
            } catch (_) { /* ignore parse errors */ }
            throw new Error(`Survey submit failed: ${errMsg}`);
        }

        alert("✔ Form task submission and reflection survey securely registered in SQL Server!");
        window.location.href = "/Student/Dashboard";
    } catch (err) {
        alert(`Error submitting results: ${err.message}`);
    }
}

// ================= STUDENT MISTAKE BANK =================

async function openStudentMistakeBankWithReload() {
    const container = document.getElementById('mistakeBankCoreContent');
    if (!container) return;
    container.innerHTML = "";

    try {
        const urlParams = new URLSearchParams(window.location.search);
        let qTitle = urlParams.get('quizTitle');

        if (!qTitle) {
            const resQ = await fetch(`${API_BASE}/questions/quizzes`);
            if (resQ.ok) {
                const quizzes = await resQ.json();
                if (quizzes.length > 0) {
                    qTitle = quizzes[0].title || quizzes[0].Title;
                }
            }
        }

        if (!qTitle) {
            container.innerHTML = `<div class="text-center p-4 text-secondary small">No active quizzes found.</div>`;
            return;
        }

        state.selectedQuizTitle = qTitle;
        const titleQuery = `?quizTitle=${encodeURIComponent(qTitle)}`;

        const resQ = await fetch(`${API_BASE}/questions${titleQuery}`);
        if (resQ.ok) {
            const dataQ = await resQ.json();
            state.quizMode = dataQ.quizMode ?? "Manual";
            state.activeTaskTitle = dataQ.title;
            state.totalScore = dataQ.totalScore ?? 10.0;
        }

        const res = await fetch(`${API_BASE}/student/mistake-bank/${state.user.id}${titleQuery}`);
        if (!res.ok) {
            container.innerHTML = `<div class="text-center p-4 text-secondary small">No grading reviews are available for your submissions yet for "${qTitle}".</div>`;
            return;
        }

        const data = await res.json();

        // Separate correct and incorrect answers
        const incorrectAnswers = data.answers.filter(a => a.isCorrect === false);
        const correctAnswers = data.answers.filter(a => a.isCorrect === true);

        let mistakeBankHTML = `
            <div class="mb-4 p-3 border rounded bg-light" style="border-color: var(--border-color) !important;">
                <h5 class="fw-bold mb-1 text-dark" style="font-family: var(--font-heading);">${state.activeTaskTitle}</h5>
                <div class="d-flex justify-content-between align-items-center mt-2 flex-wrap gap-2">
                    <span class="text-secondary small">Submission Status: <span class="badge-custom badge-custom-emerald">${data.status}</span></span>
                    <strong class="text-indigo font-monospace" style="font-size: 15px;">Final Score Registry: ${data.finalScore} / ${state.totalScore} pts</strong>
                </div>
            </div>`;

        // 1. INCORRECT ANSWERS (Mistake Bank Section)
        mistakeBankHTML += `
            <div class="mb-4">
                <h5 class="fw-bold text-rose mb-3" style="font-family: var(--font-heading);">
                    ⚠️ Mistake Bank - Active Defects (${incorrectAnswers.length})
                </h5>`;

        if (incorrectAnswers.length === 0) {
            mistakeBankHTML += `
                <div class="alert-custom alert-custom-success small">
                    🎉 Excellent work! No defect tags are currently active for this assignment cycle.
                </div>`;
        } else {
            incorrectAnswers.forEach(q => {
                const qIdx = data.answers.findIndex(ans => ans.questionId === q.questionId);
                const questionIndex = qIdx >= 0 ? qIdx + 1 : q.questionId;
                
                mistakeBankHTML += `
                    <div class="glass-card mb-3 border-start border-3 border-danger">
                        <div class="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
                            <span class="badge-custom badge-custom-cyan">Question #${questionIndex} | Topic: ${q.questionTopic}</span>
                            <span class="badge-custom badge-custom-rose">❌ Defect Tag Applied</span>
                        </div>`;
                if (state.quizMode !== "PDF") {
                    mistakeBankHTML += `<h6 class="fw-bold text-dark mb-2">${q.questionPrompt}</h6>`;
                }
                mistakeBankHTML += `
                        <div class="small text-secondary mb-1">Your Submission Output:</div>
                        <pre class="p-2 code-input rounded small opacity-75 mb-3" style="background: #0d1117; border: 1px solid var(--border-color);">${q.studentAnswer || '[Empty Answer]'}</pre>
                        
                        <div class="review-block p-3 rounded bg-light border border-secondary border-opacity-10 mb-2">
                            <div class="small text-secondary mb-2">Your difficulty rating: <span class="badge bg-secondary">${q.difficulty || 'Medium'}</span></div>
                            <div class="small text-secondary mb-2">Your comments/pain points: <em>"${q.commentNote || 'No notes.'}"</em></div>`;

                if (q.questionType === "MCQ") {
                    mistakeBankHTML += `
                        <span class="text-rose fw-semibold small d-block">❌ Auto-Graded Check: Incorrect response.</span>
                        <p class="text-secondary small mb-0 mt-1">Your response: Option "${q.studentAnswer}". Correct answer key: <strong>Option ${q.correctKey || 'B'}</strong>.</p>`;
                } else if (q.questionType === "Essay") {
                    mistakeBankHTML += `
                        <span class="text-rose fw-semibold small d-block">❌ Defect Card Details Applied:</span>
                        <div class="my-2">
                            <span class="badge bg-danger fs-6 text-white">${q.teacherTag || 'Pending check'}</span>
                        </div>
                        <div class="d-flex gap-2 mt-3 flex-wrap">
                            <button class="btn btn-sm btn-dark-custom" onclick="window.location.href='/Forum'">
                                👉 Discuss in Forum topic
                            </button>
                            <button class="btn btn-sm btn-outline-custom border-danger text-rose" onclick="initiateStudentDisputeTicket(${q.questionId})" ${data.disputeStatus !== 'None' ? 'disabled' : ''}>
                                ⚠️ Dispute Grade (Private Chat)
                            </button>
                        </div>
                        <div id="studentEmbeddedPrivateChatZoneArea-${q.questionId}" class="mt-3"></div>`;
                }

                mistakeBankHTML += `</div></div>`;
            });
        }
        mistakeBankHTML += `</div>`;

        // 2. CORRECT ANSWERS (Full Quiz Review Section)
        mistakeBankHTML += `
            <div class="mb-4">
                <h5 class="fw-bold text-emerald mb-3" style="font-family: var(--font-heading);">
                    🟢 Passed Items Review (${correctAnswers.length})
                </h5>`;

        if (correctAnswers.length === 0) {
            mistakeBankHTML += `
                <div class="text-secondary small italic p-2 bg-light rounded text-center border">
                    No fully passed items registered for this workspace review.
                </div>`;
        } else {
            correctAnswers.forEach(q => {
                const qIdx = data.answers.findIndex(ans => ans.questionId === q.questionId);
                const questionIndex = qIdx >= 0 ? qIdx + 1 : q.questionId;

                mistakeBankHTML += `
                    <div class="glass-card mb-3 border-start border-3 border-success opacity-85">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <span class="badge-custom badge-custom-cyan">Question #${questionIndex} | Topic: ${q.questionTopic}</span>
                            <span class="badge-custom badge-custom-emerald">🟢 Passed</span>
                        </div>`;
                if (state.quizMode !== "PDF") {
                    mistakeBankHTML += `<h6 class="fw-bold text-dark mb-2">${q.questionPrompt}</h6>`;
                }
                mistakeBankHTML += `
                        <div class="small text-secondary mb-1">Your Submission Output:</div>
                        <pre class="p-2 code-input rounded small opacity-75 mb-3" style="background: #0d1117; border: 1px solid var(--border-color);">${q.studentAnswer || '[Empty Answer]'}</pre>
                        
                        <div class="review-block p-3 rounded bg-light border border-secondary border-opacity-10">
                            <div class="small text-secondary mb-2">Your difficulty rating: <span class="badge bg-secondary">${q.difficulty || 'Medium'}</span></div>
                            <div class="small text-secondary">Your comments/pain points: <em>"${q.commentNote || 'No notes.'}"</em></div>
                        </div>
                    </div>`;
            });
        }
        mistakeBankHTML += `</div>`;

        container.innerHTML = mistakeBankHTML;

        // Render embedded private chat rooms if there are failed essays
        renderStudentEmbeddedPrivateChatArea(data.answers);
    } catch (err) {
        container.innerHTML = `<div class="alert-custom alert-custom-warning small">Error loading review desk: ${err.message}</div>`;
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

// Sidebar quiz list and selection operations
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
                            <option value="B" ${q.correctKey==='B'?'selected':''}>Option B</option>
                            <option value="A" ${q.correctKey==='A'?'selected':''}>Option A</option>
                            <option value="C" ${q.correctKey==='C'?'selected':''}>Option C</option>
                            <option value="D" ${q.correctKey==='D'?'selected':''}>Option D</option>
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

async function switchRosterSubTab(subTab) {
    state.activeRosterSubTab = subTab;
    document.querySelectorAll('.sub-tab-link').forEach(l => l.classList.remove('active'));
    document.getElementById(`sub-btn-${subTab}`).classList.add('active');

    const heading = document.getElementById('rosterBlockHeadingTitle');
    const headerColumn = document.getElementById('dynamicRosterNoteColumnHeader');
    
    if (subTab === "pending") {
        heading.innerText = "📥 Ungraded Student Submissions Queue";
        headerColumn.innerText = "Stated Survey Pain Point";
    } else if (subTab === "graded") {
        heading.innerText = "🟢 Evaluated Student Logs";
        headerColumn.innerText = "Cognitive Complexity Level";
    } else if (subTab === "dispute") {
        heading.innerText = "🚨 Active Student Dispute Forms Pipeline";
        headerColumn.innerText = "Live Dispute Argument Statement";
    }

    renderMultiStudentRosterTable();
}

async function renderMultiStudentRosterTable() {
    const tbody = document.getElementById('multiStudentRosterTableBody');
    if (!tbody) return;
    tbody.innerHTML = "";

    try {
        const titleQuery = state.selectedQuizTitle ? `&quizTitle=${encodeURIComponent(state.selectedQuizTitle)}` : "";
        const res = await fetch(`${API_BASE}/instructor/roster?subTab=${state.activeRosterSubTab}${titleQuery}`);
        if (!res.ok) throw new Error();
        
        const roster = await res.json();
        
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
            tbody.innerHTML = `<tr><td colspan='5' class='text-center text-secondary p-4 small'>No student data rows registered in this section queue.</td></tr>`;
            return;
        }

        roster.forEach(student => {
            let btnText = "Grade Form";
            let btnClass = "btn-dark-custom";
            
            if (state.activeRosterSubTab === "graded") {
                btnText = "Review Paper Workspace";
                btnClass = "btn-outline-custom";
            } else if (state.activeRosterSubTab === "dispute") {
                btnText = "🚨 Audit Dispute";
                btnClass = "btn-dark-custom bg-danger border-danger";
            }

            const titleParam = state.selectedQuizTitle ? `&quizTitle=${encodeURIComponent(state.selectedQuizTitle)}` : "";
            const actionBtnMarkup = `<button class="btn btn-sm ${btnClass} py-1 px-3" style="font-size:12px;" onclick="window.location.href='/Instructor/Grading?studentId=${student.studentId}${titleParam}'">${btnText}</button>`;
            const displayScoreNode = student.status === 'Graded' ? `${student.finalScore} pts` : '--';

            tbody.innerHTML += `
                <tr>
                    <td><strong>${student.studentName}</strong></td>
                    <td class="text-secondary font-monospace" style="font-size:12px;">Submission_Stream_${student.studentId}.json</td>
                    <td class="text-center text-secondary small italic">${student.surveyPainPoint || 'No notes.'}</td>
                    <td class="text-center fw-bold font-monospace text-cyan small">${displayScoreNode}</td>
                    <td>${actionBtnMarkup}</td>
                </tr>`;
        });
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan='5' class='text-center text-danger p-4 small'>Error loading roster. Check console.</td></tr>`;
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
    const deadlineVal = document.getElementById('inputQuizDeadline').value || null;
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

        const layoutArea = document.getElementById('gradingWorkspaceLayoutArea');
        if (layoutArea && state.quizMode === "PDF") {
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
                                🟢 Commit Audit Evaluation
                            </button>
                        </div>
                    </div>
                    
                    <!-- Dispute private chat ticket zone -->
                    <div class="glass-panel" id="instructorDisputeTicketBlock" style="border-color: var(--border-color) !important;">
                        <h5 class="fw-bold border-bottom border-secondary pb-2 mb-3" style="font-family: var(--font-heading);">Private Dispute Log Thread</h5>
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
                        <h5 class="fw-bold border-bottom border-secondary pb-2 mb-4" style="font-family: var(--font-heading);">Submission Outputs Loop</h5>
                        <div id="gradingQuestionsLoopContainer"></div>
                        <div class="d-grid mt-4">
                            <button class="btn btn-dark-custom btn-lg py-2.5 fw-bold" onclick="instructorSubmitEvaluation()">
                                🟢 Commit Audit Evaluation
                            </button>
                        </div>
                    </div>
                    
                    <!-- Dispute private chat ticket zone -->
                    <div class="glass-panel" id="instructorDisputeTicketBlock" style="border-color: var(--border-color) !important;">
                        <h5 class="fw-bold border-bottom border-secondary pb-2 mb-3" style="font-family: var(--font-heading);">Private Dispute Log Thread</h5>
                        <div id="instructorPrivateTicketChatAreaZone"></div>
                    </div>
                </div>
            `;
        }

        const res = await fetch(`${API_BASE}/student/mistake-bank/${studentId}${titleQuery}`);
        if (!res.ok) throw new Error("Could not fetch submission details.");
        const studentObj = await res.json();

        const auditBox = document.getElementById('surveyAuditCrossCheckModule');
        const mcqAnswerObj = studentObj.answers.find(a => a.questionType === "MCQ");
        const essayAnswerObj = studentObj.answers.find(a => a.questionType === "Essay");

        const hasPerfectMCQ = mcqAnswerObj ? mcqAnswerObj.isCorrect === true : false;
        
        if (hasPerfectMCQ && essayAnswerObj && essayAnswerObj.difficulty === "Hard" && studentObj.surveyPainPoint !== "Awaiting reflection survey...") {
            auditBox.innerHTML = `
                <div class="alert-custom alert-custom-warning border-warning">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                    <div>
                        <strong>Automated Cross-Check Metric Anomaly:</strong> Student scored perfect accuracy on MCQ but logged subjective survey reflections as <strong>"Hard"</strong>. Possible pacing manipulation identified!
                    </div>
                </div>`;
        } else {
            auditBox.innerHTML = `
                <div class="alert-custom alert-custom-success">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    <div>
                        <strong>Cross-Validation Audit Concluded:</strong> Reflection survey ratings align properly with objective scoring criteria.
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
                    noteHTML = `<div class="p-2 border border-dashed rounded text-secondary small font-monospace mb-3" style="border-color: var(--border-color) !important;">Subjective Reflection Note: "${a.commentNote}"</div>`;
                }

                rowHTML += `
                    <label class="form-label small text-secondary fw-semibold mt-2">Student Response Logic Payload Asset:</label>
                    <pre class="p-2 rounded text-cyan font-monospace bg-dark-subtle small mb-2 border" style="border-color: var(--border-color) !important; white-space: pre-wrap;">${a.studentAnswer || '// No code streams registered.'}</pre>
                    ${noteHTML}
                    
                    <div class="p-3 border rounded bg-light" style="border-color: var(--border-color) !important;">
                        <h6 class="fw-bold text-dark mb-3" style="font-size: 13px;">Grade Allocation for Question #${idx + 1}</h6>
                        
                        <div class="mb-3">
                            <label class="form-label text-secondary small fw-semibold">ASSIGN EVALUATION SCORE RESULT:</label>
                            <div class="input-group input-group-sm" style="width: 200px;">
                                <input type="number" step="0.1" min="0" max="${a.maxScore}" class="form-control text-center font-monospace fw-bold text-cyan grading-score-input" data-qid="${a.questionId}" value="${a.earnedScore}">
                                <span class="input-group-text bg-light text-secondary small">/ ${a.maxScore} pts</span>
                            </div>
                        </div>

                        <div class="mb-3">
                            <label class="form-label text-secondary small fw-semibold d-block">APPLY DEFECT TEMPLATE CARD:</label>
                            <div class="small text-secondary mb-2 italic">Active Selection: <strong class="text-rose" id="selected-tag-label-${a.questionId}">${(a.teacherTag && a.teacherTag !== 'Pending' && a.teacherTag !== 'Passed Evaluation Checklist') ? a.teacherTag : 'None (Evaluating Asset as Compliant)'}</strong></div>
                            <div class="d-flex flex-wrap gap-2 mb-3 overflow-y-auto q-template-bank" style="max-height: 120px;" id="q-template-bank-${a.questionId}" data-qid="${a.questionId}">
                                <!-- Dynamic options for error tags -->
                            </div>
                        </div>

                        <div class="mb-2 p-2 border rounded bg-dark-subtle" style="border-color: var(--border-color) !important;">
                            <label class="form-label text-secondary small fw-semibold" style="font-size: 11px;">GENERATE NEW ERROR TEMPLATE TYPE:</label>
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

        renderInstructorPrivateTicketChatArea(studentId, studentObj.answers);
        loadInstructorGrowCards(studentObj.answers);
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

        grades.push({
            questionId: qId,
            earnedScore: scoreVal,
            chosenTag: chosenTag
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
    const container = document.getElementById('student-forum-container-target');
    if (!container) return;

    try {
        // Determine which quiz to show forum for
        const urlParams = new URLSearchParams(window.location.search);
        const quizTitleParam = urlParams.get('quizTitle') || state.selectedQuizTitle || state.activeTaskTitle;
        const titleQuery = quizTitleParam ? `?quizTitle=${encodeURIComponent(quizTitleParam)}` : "";

        const resQ = await fetch(`${API_BASE}/questions${titleQuery}`);
        if (!resQ.ok) throw new Error("Failed to load forum status.");
        const dataQ = await resQ.json();
        const isForumActive = dataQ.isForumOpen ?? true;
        
        state.activeTaskTitle = dataQ.title;
        state.isForumOpen = isForumActive;
        state.quizMode = dataQ.quizMode ?? "Manual";

        if (!isForumActive) {
            container.innerHTML = `
                <div class="glass-panel text-center py-5">
                    <h5 class="fw-bold text-rose mb-3">&#x1F4AC; Course Forum Hub Locked</h5>
                    <p class="text-secondary small">The instructor has closed active discussions for this assessment cycle.</p>
                </div>`;
            return;
        }

        // Detect MCQ-only quiz
        const allMCQ = dataQ.questions.length > 0 && dataQ.questions.every(q => q.type === "MCQ");

        // Teacher → accordion of all topics
        if (state.user.role === 'teacher') {
            const allTopics = new Set();
            dataQ.questions.forEach(q => { if (q.topic) allTopics.add(q.topic); });
            const topicsList = [...Array.from(allTopics), "General Q&A"];
            renderTeacherForumInterface(topicsList);
            return;
        }

        // Student → always show forum (no grading gate)
        // Collect all quiz topics
        const allQuizTopics = new Set();
        dataQ.questions.forEach(q => { if (q.topic) allQuizTopics.add(q.topic); });
        const allQuizTopicsList = Array.from(allQuizTopics);

        // Try to get their grading to route them to failed topics first
        let failedTopicsList = [];
        try {
            const resBank = await fetch(`${API_BASE}/student/mistake-bank/${state.user.id}${titleQuery}`);
            if (resBank.ok) {
                const dataBank = await resBank.json();
                if (dataBank.status === "Graded") {
                    dataBank.answers.forEach(ans => {
                        if (ans.isCorrect === false) failedTopicsList.push(ans.questionTopic);
                    });
                    // Deduplicate
                    failedTopicsList = [...new Set(failedTopicsList)];
                }
            }
        } catch (_) { /* ignore — still show forum */ }

        if (failedTopicsList.length > 0) {
            // Show failed topics first, then General Q&A
            renderStudentForumInterface([...failedTopicsList, "General Q&A"], failedTopicsList[0]);
        } else {
            // No failures (perfect score OR not yet graded) → show General Q&A
            renderStudentForumInterface(["General Q&A"], "General Q&A");
        }

    } catch (err) {
        container.innerHTML = `<div class="alert-custom alert-custom-warning small">Error loading forum: ${err.message}</div>`;
    }
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
    const titleEl = document.getElementById(`${panelId}-title`);
    const urlEl   = document.getElementById(`${panelId}-url`);
    if (!titleEl || !urlEl) return;

    const matTitle = titleEl.value.trim();
    const matUrl   = urlEl.value.trim();
    if (!matTitle || !matUrl) return alert('Please fill in both the title and URL/description.');

    const message = `&#x1F4CE; [Study Material] ${matTitle} — ${matUrl}`;

    try {
        const scopedTopic = `${state.activeTaskTitle} - ${topic}`;
        await fetch(`${API_BASE}/forum/comment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                isPrivate: false,
                studentId: 'all',
                topic: scopedTopic,
                sender: `${state.user.name} (Instructor)`,
                message
            })
        });
        titleEl.value = '';
        urlEl.value   = '';
        teacherToggleUpload(panelId);
        // Find accordion idx and reload
        const chatId = panelId.replace('forum-upload-panel-', 'forum-chat-');
        const chatEl = document.getElementById(chatId);
        if (chatEl && chatEl.style.display !== 'none') {
            renderUnifiedForumComponent(chatId, topic);
        }
    } catch (err) {
        alert('Failed to post material.');
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

        const isForumActive = state.isForumOpen ?? true;

        const studyGuide = getStudyGuideForTopic(filterTopic);
        let studyGuideHTML = "";
        if (studyGuide) {
            studyGuideHTML = `
                <div class="alert alert-info p-3 mb-3 border rounded shadow-sm d-flex align-items-start gap-2" style="background-color: #f0fdf4; border-color: #bbf7d0 !important; color: #166534;">
                    <div style="font-size: 1.2rem; line-height: 1;">💡</div>
                    <div class="small fw-semibold">${studyGuide}</div>
                </div>`;
        }

        container.innerHTML = `
            <div class="glass-panel p-3">
                <h5 class="fw-bold text-dark border-bottom border-secondary pb-2 mb-3">💬 Course Forum Hub Room: ${filterTopic} for ${state.activeTaskTitle}</h5>
                ${studyGuideHTML}
                <div class="chat-window">
                    <div class="chat-header">Active Public Discussion Stream</div>
                    <div class="p-3">
                        <div class="chat-message-stream mb-3" style="height: 250px;">
                            ${commentsHTMLStream}
                        </div>
                        ${isForumActive ? `
                        <div class="input-group">
                            <input type="text" id="inputLiveCommentTextString" class="form-control" placeholder="Post a query peer comment...">
                            <button class="btn btn-dark-custom" onclick="dispatchLiveCommentSubmission('${targetContainerID}', '${filterTopic}')">Comment</button>
                        </div>` : `
                        <div class="alert-custom alert-custom-warning small text-center">
                            🔒 This discussion room is locked by the instructor.
                        </div>`}
                    </div>
                </div>
            </div>`;
    } catch (err) {
        container.innerHTML = `<div class="alert-custom alert-custom-warning small">Error loading forum comments.</div>`;
    }
}

async function dispatchLiveCommentSubmission(targetContainerID, filterTopic) {
    const field = document.getElementById('inputLiveCommentTextString');
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

        renderUnifiedForumComponent(targetContainerID, filterTopic);
    } catch (err) {
        alert("Failed to post comment.");
    }
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
