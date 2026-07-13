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

/**
 * Fetches the current user's notifications from the backend API,
 * updates the UI notification badge, and populates the dropdown list.
 */
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
    // Team Member 2 : Kelly - Load student-assigned quizzes and mistake banks, rendering status buttons based on submission records.
    try {
        // FIXED: Used the correct container ID from index.html instead of the non-existent one
        const dashboard = document.getElementById("assignmentContainerStudent");
        if (!dashboard) return;
        dashboard.innerHTML = "";
        // Fetch all active quizzes
        const quizzesRes = await fetch(`${API_BASE}/questions/quizzes`);
        if (!quizzesRes.ok) throw new Error("Failed to load quizzes.");
        const quizzes = await quizzesRes.json();
        // Iterate through each quiz to generate quiz cards
        for (const quiz of quizzes) {
            const card = document.createElement("div");
            // FIXED: Added standard styling class names to align with premium glassmorphism theme
            card.className = "glass-card d-flex flex-column gap-3 mb-3 p-3";
            // Title and header section
            const headerDiv = document.createElement("div");
            headerDiv.className = "d-flex justify-content-between align-items-center";

            const title = document.createElement("strong");
            title.className = "d-block text-white";
            title.textContent = quiz.title;
            headerDiv.appendChild(title);
            card.appendChild(headerDiv);
            // FIXED: Call the correct API endpoint with quizTitle to check if submission exists
            const submissionRes = await fetch(`${API_BASE}/student/mistake-bank/${state.user.id}?quizTitle=${encodeURIComponent(quiz.title)}`);

            if (submissionRes.ok) {
                // If a submission exists, parse the status and display appropriate status badge
                const submissionData = await submissionRes.json();

                const statusBadge = document.createElement("span");
                if (submissionData.status === "Pending") {
                    statusBadge.className = "badge-custom badge-custom-amber text-center";
                    statusBadge.textContent = "✔ Submission processed. Awaiting Instructor Grading.";
                } else if (submissionData.status === "Graded") {
                    statusBadge.className = "badge-custom badge-custom-emerald text-center";
                    statusBadge.textContent = `✔ Graded. Result Score Registry: ${submissionData.finalScore} / 10.0 pts.`;
                }
                card.appendChild(statusBadge);
                // View Mistake Bank button
                const mistakeBtn = document.createElement("button");
                mistakeBtn.className = "btn btn-sm btn-outline-custom w-100";
                mistakeBtn.textContent = "View Mistake Bank";
                // FIXED: Set state variables and call the correct refresh function
                mistakeBtn.onclick = async () => {
                    state.activeTaskTitle = quiz.title;
                    openStudentMistakeBankWithReload();
                };
                card.appendChild(mistakeBtn);
            } else {
                // If no submission exists (Not Started)
                const timeInfo = document.createElement("span");
                timeInfo.className = "text-secondary small";
                timeInfo.textContent = "Time Allowed: 40 Minutes";
                headerDiv.appendChild(timeInfo);
                const examBtn = document.createElement("button");
                examBtn.className = "btn btn-dark-custom btn-sm w-100";
                examBtn.textContent = "Execute Form Task";
                // FIXED: Fetch questions for this quiz first, set state variables, and call the correct exam form function
                examBtn.onclick = async () => {
                    state.activeTaskTitle = quiz.title;

                    const qRes = await fetch(`${API_BASE}/questions?quizTitle=${encodeURIComponent(quiz.title)}`);
                    if (qRes.ok) {
                        const qData = await qRes.json();
                        state.questions = qData.questions;
                        openStudentExamForm();
                    } else {
                        alert("Failed to load questions for this exam.");
                    }
                };
                card.appendChild(examBtn);
            }
            dashboard.appendChild(card);
        }
    } catch (err) {
        console.error(err);
        dashboard.innerHTML = `<div class="alert-custom alert-custom-warning small">Error loading tasks: ${err.message}</div>`;
    }
}

async function loadQuestionsForExam() {
    // Team Member 2 Kelly - Load active quiz configuration details and initialize questions list layout.
    try {
        // Get the quiz title from URL search parameters (if any)
        const urlParams = new URLSearchParams(window.location.search);
        const qTitle = urlParams.get('quizTitle');
        const titleQuery = qTitle ? `?quizTitle=${encodeURIComponent(qTitle)}` : "";
        // Fetch quiz questions from the API using the correct query parameters
        const resQ = await fetch(`${API_BASE}/questions${titleQuery}`);
        if (!resQ.ok) throw new Error();
        const dataQ = await resQ.json();

        // Save the metadata to the global application state
        state.isQuizOpen = dataQ.isQuizOpen ?? true;
        state.deadlineString = dataQ.deadlineString ?? null;
        state.timeLimitMinutes = dataQ.timeLimitMinutes ?? 40;
        state.pdfBase64 = dataQ.pdfBase64 ?? null;
        state.quizMode = dataQ.quizMode ?? "Manual";
        state.totalScore = dataQ.totalScore ?? 10.0;

        // FIXED: Prevent access if the quiz is closed or has expired
        if (typeof isQuizActive === "function" && !isQuizActive()) {
            alert("This assessment is currently closed or has passed its deadline.");
            window.location.href = "/Student/Dashboard";
            return;
        }
        // Save active questions and title to the global state
        state.activeTaskTitle = dataQ.title;
        state.questions = dataQ.questions;

        // Update the page title element
        document.getElementById('examTitle').innerText = state.activeTaskTitle;

        // FIXED: Call the project's standard rendering function instead of duplicate document.createElement code
        openStudentExamForm();
    } catch (err) {
        console.error(err);
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
    // TODO: Team Member 2 - Collect exam answer responses and reflections, submitting payloads to exam & survey endpoints.
    alert("TODO: Team Member 2 - Implement completeSurveyPipeline in app.js");
}

// ================= STUDENT MISTAKE BANK =================

async function openStudentMistakeBankWithReload() {
    // TODO: Team Member 2 - Query student evaluation logs for active mistake checks, compiling correct/incorrect answer states.
    alert("TODO: Team Member 2 - Implement openStudentMistakeBankWithReload in app.js");
}


// Member Han  - Student dispute ticketing and private chat operations
async function initiateStudentDisputeTicket(qId) {
    // 1. User Input: Open a native browser prompt box to ask the student why they are contesting the grading
    const reason = prompt("Enter your dispute reason statement to start a private 1-on-1 chat thread with your instructor:");
    if (!reason) return; // Guard clause: Exit if the student cancels or leaves the text box blank

    try {
        // 2. Setup Payload: Assemble the necessary metadata required by the server to log the complaint
        const payload = {
            studentId: state.user.id,
            questionId: qId,
            message: reason
        };

        // 3. Network Request: Send a POST request to create the dispute ticket in the backend database
        const res = await fetch(`${API_BASE}/student/initiate-dispute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Failed to open dispute ticket.");

        // 4. Success Handling: Inform the user and trigger a UI reload to show the updated dispute status
        alert("Dispute ticket successfully created. A private dialogue has been opened.");
        openStudentMistakeBankWithReload();

    } catch (err) {
        // 5. Error Handling: Display a popup banner with the exact error message if the server request fails
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

// Member Han  - Load question diagnostics for the active quiz,
//compiling student feedback difficulty counts and flagging potential anomaly rating discrepancies.

async function loadQuestionDiagnostics() {
    // 1. DOM Check: Ensure the container element for displaying question analytics exists on the page
    const container = document.getElementById('analyticsQuestionDiagnosticsContainer');
    if (!container) return;

    try {
        // 2. Build Query & Fetch: Get student submission records for the selected quiz (handles URL encoding for special characters)
        const titleQuery = state.selectedQuizTitle ? `&quizTitle=${encodeURIComponent(state.selectedQuizTitle)}` : "";
        const resSub = await fetch(`${API_BASE}/instructor/roster?subTab=all${titleQuery}`);
        if (!resSub.ok) throw new Error();
        const submissions = await resSub.json();

        // 3. Fallback Check: If no questions exist in the global state, notify the user and exit
        if (!state.questions || state.questions.length === 0) {
            container.innerHTML = `<div class="text-center text-secondary py-3 small">No questions have been published.</div>`;
            return;
        }

        let html = "";

        // 4. Data Processing Loop: Iterate through each question to analyze its performance metrics
        state.questions.forEach((q, qIdx) => {
            let totalAnswers = 0;
            let correctAnswers = 0;
            let easyCount = 0;
            let mediumCount = 0;
            let hardCount = 0;
            let anomalies = [];

            // Nested Loop: Scan all student submissions to aggregate data specific to this question
            submissions.forEach(sub => {
                const ans = sub.answers.find(a => a.questionId === q.id);
                if (ans && ans.studentAnswer) {
                    totalAnswers++;
                    if (ans.isCorrect === true) {
                        correctAnswers++;
                    }

                    // Group student-perceived difficulty feedback distributions
                    if (ans.difficulty === 'Easy') easyCount++;
                    else if (ans.difficulty === 'Medium') mediumCount++;
                    else if (ans.difficulty === 'Hard') hardCount++;

                    // 5. Anomaly Detection: Flag students who got the item correct but subjective-rated it as "Hard"
                    if (ans.isCorrect === true && ans.difficulty === 'Hard') {
                        anomalies.push({
                            studentName: sub.studentName,
                            studentId: sub.studentId,
                            note: ans.commentNote || "No reflection notes logged."
                        });
                    }
                }
            });

            // 6. Calculate Percentages: Compute rates safely preventing potential division-by-zero errors
            const successRate = totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0;
            const easyPct = totalAnswers > 0 ? Math.round((easyCount / totalAnswers) * 100) : 0;
            const medPct = totalAnswers > 0 ? Math.round((mediumCount / totalAnswers) * 100) : 0;
            const hardPct = totalAnswers > 0 ? Math.round((hardCount / totalAnswers) * 100) : 0;

            // 7. Sub-template Generation: Build warning boxes if any survey discrepancies are flagged
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

            // 8. Construct Card Template: Assemble the combined item breakdown HTML card
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

        // 9. DOM Injection: Push all constructed cards onto the screen at once
        container.innerHTML = html;
    } catch (err) {
        // 10. Error UI State: Gracefully render a fallback error indicator card if something breaks
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


// Member Hitesh - Utility function to escape HTML special characters to prevent XSS attacks in dynamic content rendering.

function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

async function switchRosterSubTab(subTab) {
    state.activeRosterSubTab = subTab;

    // 1. Update sub-tab button active states
    ['pending', 'graded', 'dispute'].forEach(tab => {
        const btn = document.getElementById(`sub-btn-${tab}`);
        if (btn) btn.classList.toggle('active', tab === subTab);
    });

    // 2. Update the panel heading + column header to match the selected sub-tab
    const heading = document.getElementById('rosterBlockHeadingTitle');
    const noteHeader = document.getElementById('dynamicRosterNoteColumnHeader');
    if (subTab === 'pending') {
        if (heading) heading.innerText = "📥 Ungraded Student Submissions Queue";
        if (noteHeader) noteHeader.innerText = "Stated Survey Pain Point";
    } else if (subTab === 'graded') {
        if (heading) heading.innerText = "🟢 Graded Submission Logs";
        if (noteHeader) noteHeader.innerText = "Stated Survey Pain Point";
    } else if (subTab === 'dispute') {
        if (heading) heading.innerText = " 🚨Active Dispute Tickets";
        if (noteHeader) noteHeader.innerText = "Dispute Status";
    }

    // 3. Load the table for the selected sub-tab
    await renderMultiStudentRosterTable();

    // 4. Refresh the dispute badge count independently, so it stays visible even when
    //    the instructor is looking at a different sub-tab (e.g. "Pending").
    await refreshDisputeBadgeCount();
}

// Hitesh - Load and render the multi-student roster table based on the currently selected sub-tab and quiz title.
async function renderMultiStudentRosterTable() {
    const tbody = document.getElementById('multiStudentRosterTableBody');
    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="5" class="text-center text-secondary p-4 small">
                <div class="spinner-border spinner-border-sm text-cyan me-2" role="status"></div>
                Loading student roster datasets...
            </td>
        </tr>`;

    try {
        const titleQuery = state.selectedQuizTitle ? `&quizTitle=${encodeURIComponent(state.selectedQuizTitle)}` : "";
        const res = await fetch(`${API_BASE}/instructor/roster?subTab=${state.activeRosterSubTab}${titleQuery}`);
        if (!res.ok) throw new Error("Failed to fetch roster.");

        const submissions = await res.json();

        if (!submissions || submissions.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center text-secondary p-4 small">
                        No submissions found for this view.
                    </td>
                </tr>`;
            return;
        }

        tbody.innerHTML = submissions.map(sub => {
            // FIXED: Restore dynamic action button styles and labels based on the active sub-tab
            let btnText = "Grade Form";
            let btnClass = "btn-dark-custom";

            if (state.activeRosterSubTab === "graded") {
                btnText = "Review Paper Workspace";
                btnClass = "btn-outline-custom";
            } else if (state.activeRosterSubTab === "dispute") {
                btnText = "🚨 Audit Dispute";
                btnClass = "btn-dark-custom bg-danger border-danger";
            }
            // FIXED: Render the actual survey note/dispute message instead of a status badge
            const noteCellContent = `<span class="text-secondary small italic">${escapeHtml(sub.surveyPainPoint) || 'No notes.'}</span>`;
            // FIXED: Restore cyan bold monospace score style from original layout
            const scoreCellContent = sub.status === 'Graded'
                ? `${sub.finalScore} pts`
                : '--';


            // Action button routes to the grading desk for this student + quiz
            const gradingUrl = `/Instructor/Grading?studentId=${encodeURIComponent(sub.studentId)}&quizTitle=${encodeURIComponent(state.selectedQuizTitle || '')}`;
            // FIXED: Column 2 restored to "Submission_Stream_[studentId].json" to match the column header
            return `
                <tr>
                    <td><strong>${escapeHtml(sub.studentName)}</strong></td>
                    <td class="text-secondary font-monospace" style="font-size:12px;">Submission_Stream_${escapeHtml(sub.studentId)}.json</td>
                    <td class="text-center">${noteCellContent}</td>
                    <td class="text-center fw-bold font-monospace text-cyan small">${scoreCellContent}</td>
                    <td><a class="btn btn-sm ${btnClass} py-1 px-3" style="font-size:12px;" href="${gradingUrl}">${btnText}</a></td>
                </tr>`;
        }).join('');
    } catch (err) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center p-4 small">
                    <div class="alert-custom alert-custom-warning d-inline-block">Error loading roster: ${escapeHtml(err.message)}</div>
                </td>
            </tr>`;
    }
}
async function remindPendingStudents() {
    if (!confirm("Send a reminder notification to all students with pending submissions?")) return;

    try {
        const titleQuery = state.selectedQuizTitle ? `?quizTitle=${encodeURIComponent(state.selectedQuizTitle)}` : "";
        const res = await fetch(`${API_BASE}/instructor/remind-pending${titleQuery}`, { method: 'POST' });
        if (!res.ok) throw new Error("Failed to send reminders.");

        const data = await res.json();
        alert(data.message || `Reminded ${data.count} student(s).`);
    } catch (err) {
        alert(`Error: ${err.message}`);
    }
}

// Keeps the "Active Disputes" badge count fresh regardless of which sub-tab is showing.
async function refreshDisputeBadgeCount() {
    const badge = document.getElementById('subTabTicketBadgeCount');
    if (!badge) return;

    try {
        const titleQuery = state.selectedQuizTitle ? `&quizTitle=${encodeURIComponent(state.selectedQuizTitle)}` : "";
        const res = await fetch(`${API_BASE}/instructor/roster?subTab=dispute${titleQuery}`);
        if (!res.ok) return;

        const disputes = await res.json();
        const count = disputes ? disputes.length : 0;

        if (count > 0) {
            badge.style.display = 'inline-block';
            badge.innerText = count > 9 ? '9+' : count;
        } else {
            badge.style.display = 'none';
        }
    } catch (_) {
        /* Fail silently — badge just won't update this cycle */
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
