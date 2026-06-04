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
    
    errorTags: [], // Grow-As-You-Go error tag templates
    chosenTag: null, // Error tag selected during grading
    activeGradingStudentID: null, // Student currently being evaluated
    
    examTimerInterval: null,
    examSecondsRemaining: 2394 // 39:54
};

// Transition between screens cleanly
function switchScreen(id) {
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
        
        // Show session avatar & user details
        document.getElementById('appUserSession').style.display = "flex";
        const avatar = document.getElementById('sessionAvatar');
        avatar.innerText = state.user.name.split(' ').map(n => n[0]).join('').toUpperCase();
        avatar.style.backgroundColor = state.user.role === 'student' ? 'var(--accent-indigo)' : 'var(--accent-cyan)';
        document.getElementById('sessionNameDisplay').innerText = `${state.user.name} (${state.user.role === 'student' ? 'Student' : 'Instructor'})`;
        
        if (state.user.role === 'student') {
            switchScreen('screen-student-dash');
            renderStudentDashboard();
        } else {
            switchScreen('screen-teacher-dash');
            switchTeacherTab('analytics');
        }
    } catch (err) {
        alert(`Authentication Error: ${err.message}. Make sure the ASP.NET Core API is running!`);
    }
}

function logoutSystem() {
    state.user = null;
    document.getElementById('appUserSession').style.display = "none";
    clearInterval(state.examTimerInterval);
    switchScreen('screen-home');
}

// ================= STUDENT WORKSPACE FLOW =================

async function renderStudentDashboard() {
    const box = document.getElementById('assignmentContainerStudent');
    if (!box) return;

    try {
        // 1. Fetch active task configurations
        const resQ = await fetch(`${API_BASE}/questions`);
        if (!resQ.ok) throw new Error("Failed to load active questions.");
        const dataQ = await resQ.json();
        state.activeTaskTitle = dataQ.title;
        state.questions = dataQ.questions;

        // Update dashboard mistake bank badge count
        const resBank = await fetch(`${API_BASE}/student/mistake-bank/${state.user.id}`);
        let badgeCount = 0;
        let submissionStatus = "NotStarted";
        let finalScore = 0;

        if (resBank.ok) {
            const dataBank = await resBank.json();
            finalScore = dataBank.finalScore;
            submissionStatus = dataBank.status; // "Pending" or "Graded"
            
            // Defect badge count is 1 if they have any graded answers marked as incorrect
            if (dataBank.status === "Graded") {
                const hasErrors = dataBank.answers.some(a => a.isCorrect === false);
                if (hasErrors) badgeCount = 1;
            }
        }
        
        document.getElementById('dashMistakeBadge').innerText = badgeCount;

        if (submissionStatus === "Pending") {
            box.innerHTML = `
                <div class="d-flex justify-content-between align-items-center small p-3 rounded glass-card">
                    <span class="fw-semibold">${state.activeTaskTitle}</span>
                    <span class="badge-custom badge-custom-amber">✔ Submission processed. Awaiting Instructor Grading.</span>
                </div>`;
        } else if (submissionStatus === "Graded") {
            box.innerHTML = `
                <div class="d-flex justify-content-between align-items-center small p-3 rounded glass-card">
                    <span class="fw-semibold">${state.activeTaskTitle}</span>
                    <span class="badge-custom badge-custom-emerald">✔ Graded. Result Score Registry: ${finalScore} / 10.0 pts.</span>
                </div>`;
        } else {
            // Not Started
            box.innerHTML = `
                <div class="d-flex justify-content-between align-items-center p-3 rounded glass-card">
                    <div>
                        <strong class="d-block">${state.activeTaskTitle}</strong>
                        <span class="text-secondary small">Time Allowed: 40 Minutes</span>
                    </div>
                    <button class="btn btn-dark-custom btn-sm px-4" onclick="openStudentExamForm()">Execute Form Task</button>
                </div>`;
        }
    } catch (err) {
        box.innerHTML = `<div class="alert-custom alert-custom-warning small">Error loading tasks: ${err.message}</div>`;
    }
}

function openStudentExamForm() {
    switchScreen('screen-student-exam');
    document.getElementById('examTitle').innerText = state.activeTaskTitle;
    
    // Timer Reset
    state.examSecondsRemaining = 2394; 
    startExamTimer();

    const container = document.getElementById('studentActiveQuestionsArea');
    if (!container) return;
    container.innerHTML = "";

    state.questions.forEach((q) => {
        let cardHTML = `<div class="glass-card mb-4">`;
        cardHTML += `<h6 class="fw-bold mb-3">${q.prompt}</h6>`;
        
        if (q.type === "MCQ") {
            cardHTML += `<div class="d-flex flex-column">`;
            q.options.forEach(opt => {
                const optKey = opt.trim().substring(0, 1); // Extract "A", "B", etc.
                cardHTML += `
                    <div class="mcq-option-card" id="mcq-card-${q.id}-${optKey}" onclick="selectStudentMCQOption(${q.id}, '${optKey}', '${opt.replace(/'/g, "\\'")}')">
                        <div class="mcq-radio-dot" id="mcq-dot-${q.id}-${optKey}"></div>
                        <span class="small">${opt}</span>
                    </div>`;
            });
            cardHTML += `</div>`;
        } else if (q.type === "Essay") {
            cardHTML += `
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
        cardHTML += `</div>`;
        container.innerHTML += cardHTML;
    });
}

function selectStudentMCQOption(qId, key, optText) {
    // Clear selections in this question
    const q = state.questions.find(quest => quest.id === qId);
    if (!q) return;

    q.options.forEach(opt => {
        const k = opt.trim().substring(0, 1);
        const card = document.getElementById(`mcq-card-${qId}-${k}`);
        if (card) card.classList.remove('selected');
    });

    // Select this card
    const selectedCard = document.getElementById(`mcq-card-${qId}-${key}`);
    if (selectedCard) selectedCard.classList.add('selected');

    // Save answer
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
        document.getElementById('examTimerDisplay').innerText = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
}

function lockExamAndOpenSurvey() {
    clearInterval(state.examTimerInterval);

    // Read values from form fields
    state.questions.forEach(q => {
        if (q.type === "Essay") {
            const val = document.getElementById(`active-student-essay-${q.id}`).value;
            state.studentAnswers[q.id] = val;
        }
    });

    switchScreen('screen-student-survey');
    
    const surveyContainer = document.getElementById('studentSurveyQuestionsRepetitionArea');
    if (!surveyContainer) return;
    surveyContainer.innerHTML = "";

    state.questions.forEach(q => {
        const studentAns = state.studentAnswers[q.id] || "No response recorded.";
        
        let blockHTML = `
            <div class="glass-card mb-4">
                <h6 class="fw-bold small text-secondary">${q.prompt}</h6>
                <div class="p-2 border rounded font-monospace bg-dark-subtle small mb-3 text-cyan opacity-75" style="border-color: var(--border-color) !important;">
                    [Student Output Data]: ${studentAns}
                </div>`;
        
        if (q.type === "Essay") {
            blockHTML += `
                <div class="p-3 border rounded bg-dark-subtle" style="border-color: var(--border-color) !important;">
                    <label class="form-label small fw-bold d-block">Rate cognitive complexity/difficulty for Question ${q.id}:</label>
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
                        <label class="form-label small text-secondary">Explain any pain points or roadblocks:</label>
                        <input type="text" class="form-control form-control-sm" id="survey-note-node-${q.id}" placeholder="e.g. Struggled mapping text abstraction layers..." oninput="updateCharCount(this, ${q.id})">
                        <div class="text-end text-secondary small mt-1" style="font-size: 11px;"><span id="survey-char-count-${q.id}">0</span>/200 chars</div>
                    </div>
                </div>`;
            
            // Set default in survey values
            state.studentSurvey[q.id] = { difficulty: "Medium", note: "" };
        }
        blockHTML += `</div>`;
        surveyContainer.innerHTML += blockHTML;
    });
}

function selectSurveyDifficulty(qId, level) {
    // Clear selections
    const opts = ['Easy', 'Medium', 'Hard'];
    opts.forEach(o => {
        const btn = document.getElementById(`emoji-${o.toLowerCase()}-${qId}`);
        if (btn) btn.classList.remove('selected');
    });

    // Set selected
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
    // Read survey comment notes
    state.questions.forEach(q => {
        if (q.type === "Essay") {
            const noteVal = document.getElementById(`survey-note-node-${q.id}`).value || "";
            state.studentSurvey[q.id].note = noteVal;
        }
    });

    try {
        // 1. Submit answers via Web API
        const examPayload = {
            studentId: state.user.id,
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

        if (!resExam.ok) throw new Error("Failed to submit exam answers.");

        // 2. Submit surveys via Web API
        const surveyPayload = {
            studentId: state.user.id,
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

        if (!resSurvey.ok) throw new Error("Failed to submit reflection survey.");

        alert("✔ Form task submission and reflection survey securely registered in SQL Server!");
        switchScreen('screen-student-dash');
        renderStudentDashboard();
    } catch (err) {
        alert(`Error submitting results: ${err.message}`);
    }
}

// ================= STUDENT MISTAKE BANK =================

async function openStudentMistakeBankWithReload() {
    switchScreen('screen-student-bank');
    const container = document.getElementById('mistakeBankCoreContent');
    if (!container) return;
    container.innerHTML = "";

    try {
        const res = await fetch(`${API_BASE}/student/mistake-bank/${state.user.id}`);
        if (!res.ok) {
            container.innerHTML = `<div class="text-center p-4 text-secondary small">No grading reviews are available for your submissions yet. Check back once your instructor has finalized evaluations.</div>`;
            return;
        }

        const data = await res.json();
        
        data.answers.forEach(q => {
            let cardHTML = `
                <div class="glass-card mb-4">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <span class="badge-custom badge-custom-cyan">Question ${q.questionId} | Topic: ${q.questionTopic}</span>
                        ${q.isCorrect === true ? `<span class="badge-custom badge-custom-emerald">🟢 Passed</span>` : `<span class="badge-custom badge-custom-rose">❌ Defect Tag Applied</span>`}
                    </div>
                    <h6 class="fw-bold mb-2">${q.questionPrompt}</h6>
                    <pre class="p-2 code-input rounded small opacity-75 mb-3" style="background: #f8fafc; border: 1px solid var(--border-color); color: var(--color-text);">${q.studentAnswer || '[Empty Answer]'}</pre>
                    <div class="review-block">`;

            if (q.questionType === "MCQ") {
                if (q.isCorrect) {
                    cardHTML += `<span class="text-emerald fw-semibold small">🟢 Auto-Graded Check: Answers verified as correct.</span>`;
                } else {
                    cardHTML += `
                        <span class="text-rose fw-semibold small">❌ Auto-Graded Check: Incorrect.</span>
                        <p class="text-secondary small mb-0 mt-1">Your checked response: Option "${q.studentAnswer}". Correct answer key: <strong>Option B</strong>.</p>`;
                }
            } else if (q.questionType === "Essay") {
                if (q.isCorrect === true) {
                    cardHTML += `<span class="text-emerald fw-semibold small">🟢 Instructor Manual Audit: Passed Evaluation Checklist.</span>`;
                } else {
                    cardHTML += `
                        <span class="text-rose fw-semibold small">❌ Defect Card Details Applied:</span>
                        <div class="my-2">
                            <span class="badge bg-danger fs-6 text-white">${q.teacherTag || 'Pending check'}</span>
                        </div>
                        <div class="small fw-semibold text-cyan mb-2">Current Score: ${data.finalScore} / 10.0 pts</div>
                        <div class="d-flex gap-2">
                            <button class="btn btn-sm btn-dark-custom" onclick="executeMistakeToForumRedirect()">
                                👉 Click to Discuss in Forum
                            </button>
                            <button class="btn btn-sm btn-outline-custom border-danger text-rose" onclick="initiateStudentDisputeTicket(${q.questionId})" ${data.disputeStatus !== 'None' ? 'disabled' : ''}>
                                ⚠️ Dispute Grade (Private Chat with Instructor)
                            </button>
                        </div>
                        <div id="studentEmbeddedPrivateChatZoneArea-${q.questionId}" class="mt-3"></div>`;
                }
            }

            cardHTML += `</div></div>`;
            container.innerHTML += cardHTML;
        });

        // Load disputes private threads
        renderStudentEmbeddedPrivateChatArea(data.answers);
    } catch (err) {
        container.innerHTML = `<div class="alert-custom alert-custom-warning small">Error loading mistake bank: ${err.message}</div>`;
    }
}

function executeMistakeToForumRedirect() {
    switchScreen('screen-student-forum-view'); 
    renderUnifiedForumComponent('student-forum-container-target', 'Text Abstractions');
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
            // Load messages
            const res = await fetch(`${API_BASE}/forum/dispute/${state.user.id}/Dispute Q${q.questionId}`);
            if (!res.ok) continue;
            
            const comments = await res.json();
            
            // Build chat logs
            const chatStream = comments.map(c => {
                const isSelf = c.sender.includes(state.user.name);
                return `<div class="comment-bubble ${isSelf ? 'self' : ''}">
                    <span class="d-block small fw-bold" style="color: var(--accent-cyan); font-size: 11px;">${c.sender}</span>
                    <span style="font-size: 12.5px;">${c.message}</span>
                </div>`;
            }).join('');

            // Locate status
            let disputeStatusText = `<span class="badge-custom badge-custom-amber">Awaiting Instructor Audit</span>`;
            
            // Re-fetch mistake bank score stats to get live dispute status
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

// ================= INSTRUCTOR DASHBOARD FLOW =================

async function switchTeacherTab(tab) {
    document.querySelectorAll('.teacher-tab-content').forEach(c => c.classList.add('d-none'));
    document.querySelectorAll('#teacherTabs .nav-link-custom').forEach(l => l.classList.remove('active'));
    
    document.getElementById(`teacher-tab-${tab}`).classList.remove('d-none');
    document.getElementById(`tab-btn-${tab}`).classList.add('active');
    
    if (tab === 'manager') {
        selectFactoryPresetOption(state.activeSelectedPresetOption);
    }
    if (tab === 'analytics') {
        switchRosterSubTab(state.activeRosterSubTab);
        loadInstructorAnalytics();
    }
    if (tab === 'forum') {
        renderUnifiedForumComponent('standalone-teacher-forum-container', 'Text Abstractions');
    }
}

async function loadInstructorAnalytics() {
    try {
        const res = await fetch(`${API_BASE}/instructor/analytics`);
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

        document.getElementById('classAvgLabelField').innerText = `Class Avg: ${data.classAverageScore} / 10.0`;
        
        // Show inline MCQ modifier if submissions exist
        if (data.totalSubmissionsCount > 0) {
            renderInlineQuestionEditSection();
        } else {
            document.getElementById('instructorPerQuestionInlineEditSection').style.display = "none";
        }
    } catch (err) {
        console.error(err);
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
        const res = await fetch(`${API_BASE}/instructor/roster?subTab=${state.activeRosterSubTab}`);
        if (!res.ok) throw new Error();
        
        const roster = await res.json();
        
        // Load dispute badges counts
        const resTix = await fetch(`${API_BASE}/instructor/roster?subTab=dispute`);
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

            const actionBtnMarkup = `<button class="btn btn-sm ${btnClass} py-1 px-3" style="font-size:12px;" onclick="routeTargetStudentToEvaluationDesk('${student.studentId}')">${btnText}</button>`;
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
function selectFactoryPresetOption(optId) {
    state.activeSelectedPresetOption = optId;
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`btn-opt-${optId}`).classList.add('active');

    const editorBlock = document.getElementById('factory-editor-form-block');
    if (!editorBlock) return;

    if (optId === 1) {
        editorBlock.innerHTML = `
            <div class="mb-2">
                <label class="small text-secondary">Question Prompt</label>
                <input type="text" class="form-control form-control-sm bg-white" id="preset-q1-prompt" value="What is 1 + 1 equal to?">
            </div>
            <div class="mb-2">
                <label class="small text-secondary">Correct Answer Option Key</label>
                <input type="text" class="form-control form-control-sm" id="preset-q1-key" style="width: 80px;" value="B">
            </div>`;
    } else if (optId === 2) {
        editorBlock.innerHTML = `
            <div class="mb-2">
                <label class="small text-secondary">Essay Prompt</label>
                <input type="text" class="form-control form-control-sm" id="preset-q2-prompt" value="Write Hello World.">
            </div>`;
    } else if (optId === 3) {
        editorBlock.innerHTML = `
            <div class="mb-2">
                <label class="small text-secondary">MCQ Question Prompt</label>
                <input type="text" class="form-control form-control-sm" id="preset-q1-prompt" value="What is 5 - 3 equal to?">
            </div>
            <div class="mb-3" style="max-width: 120px;">
                <label class="small text-secondary">MCQ Correct Key</label>
                <input type="text" class="form-control form-control-sm" id="preset-q1-key" value="A">
            </div>
            <div class="mb-2">
                <label class="small text-secondary">Essay Question Prompt</label>
                <input type="text" class="form-control form-control-sm" id="preset-q2-prompt" value="Write 'Hello'.">
            </div>`;
    } else if (optId === 4) {
        // Full Custom Creator
        editorBlock.innerHTML = `
            <div class="p-3 border rounded mb-3" style="border-color: rgba(255,255,255,0.05) !important;">
                <h6 class="small fw-bold text-white mb-2">Item #1: Multiple Choice Question (MCQ)</h6>
                <div class="mb-2">
                    <label class="small text-secondary">MCQ Prompt</label>
                    <input type="text" class="form-control form-control-sm" id="custom-q1-prompt" placeholder="Type MCQ prompt...">
                </div>
                <div class="mb-2">
                    <label class="small text-secondary">Comma-separated Options (e.g. A. True, B. False)</label>
                    <input type="text" class="form-control form-control-sm" id="custom-q1-options" placeholder="A. Option 1, B. Option 2...">
                </div>
                <div class="mb-2" style="max-width: 120px;">
                    <label class="small text-secondary">Correct Key</label>
                    <input type="text" class="form-control form-control-sm" id="custom-q1-key" placeholder="e.g. A">
                </div>
            </div>
            <div class="p-3 border rounded" style="border-color: rgba(255,255,255,0.05) !important;">
                <h6 class="small fw-bold text-white mb-2">Item #2: Essay Code Question</h6>
                <div class="mb-2">
                    <label class="small text-secondary">Essay Prompt</label>
                    <input type="text" class="form-control form-control-sm" id="custom-q2-prompt" placeholder="Type essay/code prompt...">
                </div>
            </div>`;
    }
}

async function instructorPublishTask() {
    const titleVal = document.getElementById('inputTaskTitle').value;
    if (!titleVal) return alert("Assignment title is required.");

    let questionsPayload = [];
    const preset = state.activeSelectedPresetOption;

    if (preset === 1) {
        questionsPayload.push({
            type: "MCQ",
            topic: "Math Logic",
            prompt: document.getElementById('preset-q1-prompt').value,
            options: ["A. 1", "B. 2", "C. 3", "D. 4"],
            correctKey: document.getElementById('preset-q1-key').value
        });
    } else if (preset === 2) {
        questionsPayload.push({
            type: "Essay",
            topic: "Text Abstractions",
            prompt: document.getElementById('preset-q2-prompt').value,
            correctKey: "Must match Hello."
        });
    } else if (preset === 3) {
        questionsPayload.push({
            type: "MCQ",
            topic: "Math Logic",
            prompt: document.getElementById('preset-q1-prompt').value,
            options: ["A. 2", "B. 3", "C. 4", "D. 5"],
            correctKey: document.getElementById('preset-q1-key').value
        });
        questionsPayload.push({
            type: "Essay",
            topic: "Text Abstractions",
            prompt: document.getElementById('preset-q2-prompt').value,
            correctKey: "Must match Hello."
        });
    } else if (preset === 4) {
        const q1Prompt = document.getElementById('custom-q1-prompt').value || "Default MCQ";
        const q1OptsStr = document.getElementById('custom-q1-options').value || "A. True, B. False";
        const q1Key = document.getElementById('custom-q1-key').value || "A";
        const q2Prompt = document.getElementById('custom-q2-prompt').value || "Default Essay";

        const q1Options = q1OptsStr.split(',').map(s => s.trim());

        questionsPayload.push({
            type: "MCQ",
            topic: "Custom Logic",
            prompt: q1Prompt,
            options: q1Options,
            correctKey: q1Key
        });
        questionsPayload.push({
            type: "Essay",
            topic: "Custom Abstraction",
            prompt: q2Prompt,
            correctKey: "Custom criteria validation"
        });
    }

    try {
        const payload = {
            title: titleVal,
            questions: questionsPayload
        };

        const res = await fetch(`${API_BASE}/questions/publish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Failed to publish assessment.");

        alert("✔ New assessment successfully generated and active configurations updated!");
        switchTeacherTab('analytics');
    } catch (err) {
        alert(err.message);
    }
}

// ================= INSTRUCTOR GRADING DESK FLOW =================

async function routeTargetStudentToEvaluationDesk(studentId) {
    state.activeGradingStudentID = studentId;
    switchScreen('screen-teacher-grading');

    try {
        const res = await fetch(`${API_BASE}/student/mistake-bank/${studentId}`);
        if (!res.ok) throw new Error("Could not fetch submission details.");
        const studentObj = await res.json();

        // 1. Cross-check anomaly checker logic
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
        
        // 2. Loop questions layout
        const loopContainer = document.getElementById('gradingQuestionsLoopContainer');
        loopContainer.innerHTML = "";

        studentObj.answers.forEach(a => {
            let rowHTML = `<div class="glass-card mb-3">`;
            rowHTML += `<span class="badge-custom badge-custom-cyan mb-2 d-inline-block">Question ID: ${a.questionId} | Topic: ${a.questionTopic}</span>`;
            rowHTML += `<h6 class="fw-bold small">${a.questionPrompt}</h6>`;

            if (a.questionType === "MCQ") {
                rowHTML += `<div class="small text-secondary p-2 border rounded bg-dark-subtle mt-2" style="border-color: var(--border-color) !important;">🤖 System Automated Log: Verified response: <strong>Option "${a.studentAnswer || 'None'}"</strong>.</div>`;
            } else if (a.questionType === "Essay") {
                rowHTML += `
                    <label class="form-label small text-secondary fw-semibold mt-2">Student Response Logic Payload Asset:</label>
                    <pre class="p-2 rounded text-cyan font-monospace bg-dark-subtle small mb-2 border" style="border-color: var(--border-color) !important; white-space: pre-wrap;">${a.studentAnswer || '// No code streams registered.'}</pre>
                    <div class="p-2 border border-dashed rounded text-secondary small font-monospace" style="border-color: var(--border-color) !important;">Subjective Reflection Note: "${a.commentNote || 'No survey response logs available.'}"</div>`;
            }
            rowHTML += `</div>`;
            loopContainer.innerHTML += rowHTML;
        });

        // 3. Set display modes depending on dispute
        const normalControls = document.getElementById('normalGradingBlockControls');
        if (studentObj.disputeStatus === "PendingReview") {
            normalControls.style.display = "none";
        } else {
            normalControls.style.display = "block";
            // Pre-load current essay score
            document.getElementById('inputInitialManualEssayScore').value = studentObj.finalScore;
        }

        // 4. Dispute private thread details
        renderInstructorPrivateTicketChatArea(studentId, studentObj.answers);

        // 5. Load grow tags cards templates list
        loadInstructorGrowCards();
    } catch (err) {
        alert(err.message);
    }
}

async function loadInstructorGrowCards() {
    try {
        const res = await fetch(`${API_BASE}/instructor/error-tags`);
        if (!res.ok) return;
        state.errorTags = await res.json();

        const group = document.getElementById('templateBankRadioGroup');
        group.innerHTML = "";
        state.chosenTag = null;
        document.getElementById('currentSelectedCardLabel').innerText = "None Selected (Evaluating Asset as Compliant)";

        state.errorTags.forEach((tag, idx) => {
            const div = document.createElement('div');
            div.id = `card-f${idx + 1}`;
            div.className = "error-tag-btn";
            div.innerText = tag;
            div.onclick = function() { selectTemplateCard(`card-f${idx + 1}`, tag); };
            group.appendChild(div);
        });
    } catch (err) {
        console.error(err);
    }
}

function selectTemplateCard(id, value) {
    document.querySelectorAll('.error-tag-btn').forEach(b => b.classList.remove('selected'));
    const target = document.getElementById(id);
    if (target) target.classList.add('selected');
    
    state.chosenTag = value;
    document.getElementById('currentSelectedCardLabel').innerText = value;
}

async function generateGrowCardAction() {
    const val = document.getElementById('inputGrowFeedback').value;
    if (!val) return alert("Type feedback template text parameters!");

    try {
        const formatted = `[F${state.errorTags.length + 1}] ${val}`;
        const res = await fetch(`${API_BASE}/instructor/error-tags`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formatted)
        });

        if (!res.ok) throw new Error();

        document.getElementById('inputGrowFeedback').value = '';
        await loadInstructorGrowCards();
        
        // Select the newly created card automatically
        const newIdx = state.errorTags.length;
        selectTemplateCard(`card-f${newIdx}`, formatted);
    } catch (err) {
        alert("Failed to create grow card template.");
    }
}

async function instructorSubmitEvaluation() {
    const scoreVal = parseFloat(document.getElementById('inputInitialManualEssayScore').value);
    if (isNaN(scoreVal) || scoreVal < 0 || scoreVal > 10) {
        return alert("Input score limits constraint attributes within 0-10 variables!");
    }

    try {
        const payload = {
            studentId: state.activeGradingStudentID,
            initialManualScore: scoreVal,
            chosenTag: state.chosenTag
        };

        const res = await fetch(`${API_BASE}/instructor/grade`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Failed to publish grade.");

        alert("✔ Evaluation results successfully committed to SQL Server.");
        switchScreen('screen-teacher-dash');
        switchTeacherTab('analytics');
    } catch (err) {
        alert(err.message);
    }
}

async function renderInstructorPrivateTicketChatArea(studentId, answers) {
    const area = document.getElementById('instructorPrivateTicketChatAreaZone');
    if (!area) return;

    // Find the essay question ID to bind the chat room
    const essayQ = answers.find(a => a.questionType === "Essay");
    if (!essayQ) {
        area.innerHTML = `<div class="text-center p-4 text-secondary small">No essay question found to evaluate.</div>`;
        return;
    }

    try {
        // Check if dispute ticket exists in roster list
        const resRoster = await fetch(`${API_BASE}/instructor/roster?subTab=dispute`);
        const disputesList = await resRoster.json();
        const activeDispute = disputesList.find(d => d.studentId === studentId);

        if (!activeDispute) {
            area.innerHTML = `<div class="text-center p-4 text-secondary border border-dashed rounded small" style="border-color: var(--border-color) !important;">No active dispute tickets found for this student.</div>`;
            return;
        }

        // Load comments
        const resChat = await fetch(`${API_BASE}/forum/dispute/${studentId}/Dispute Q${essayQ.questionId}`);
        const comments = await resChat.json();

        const chatStream = comments.map(c => {
            const isSelf = c.sender.includes("Instructor");
            return `<div class="comment-bubble ${isSelf ? 'self' : ''}">
                <span class="d-block small fw-bold" style="color: var(--accent-cyan); font-size: 11px;">${c.sender}</span>
                <span style="font-size: 12.5px;">${c.message}</span>
            </div>`;
        }).join('');

        area.innerHTML = `
            <div class="chat-window p-3">
                <div class="chat-message-stream mb-3">${chatStream}</div>
                <div class="input-group input-group-sm mb-4">
                    <input type="text" id="inputInstructorEmbeddedChatText" class="form-control" placeholder="Post response message...">
                    <button class="btn btn-dark-custom btn-sm" onclick="dispatchInstructorEmbeddedChat('${studentId}', ${essayQ.questionId})">Send</button>
                </div>
                
                <div class="p-3 border rounded bg-dark-subtle" style="border-color: var(--accent-rose) !important;">
                    <span class="small fw-bold text-rose d-block mb-2">🔧 VARIABLE MANUAL CREDIT OVERRIDE CONTROLLER:</span>
                    <div class="row g-2 align-items-center mb-3">
                        <div class="col-auto"><label class="small fw-semibold">Mutate score attribute register to:</label></div>
                        <div class="col-4">
                            <input type="number" step="0.1" min="0" max="10" id="inputManualOverrideScore" class="form-control text-center font-monospace fw-bold text-danger" value="${activeDispute.finalScore}">
                        </div>
                        <div class="col-auto"><span class="small text-secondary">/ Max 10 pts</span></div>
                    </div>
                    <div class="d-grid gap-2">
                        <button class="btn btn-sm btn-success py-2 fw-semibold" onclick="executeInstructorManualScoreOverride('${studentId}', ${essayQ.questionId}, true)">🟢 APPROVE DISPUTE & COMMIT OVERRIDE</button>
                        <button class="btn btn-sm btn-outline-custom border-danger text-rose py-2 fw-semibold" onclick="executeInstructorManualScoreOverride('${studentId}', ${essayQ.questionId}, false)">❌ DENY DISPUTE & LOCK SCORE</button>
                    </div>
                </div>
            </div>`;
    } catch (err) {
        area.innerHTML = `<div class="alert-custom alert-custom-warning small">Error loading dispute panel.</div>`;
    }
}

async function dispatchInstructorEmbeddedChat(studentId, qId) {
    const val = document.getElementById('inputInstructorEmbeddedChatText').value;
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

        // Refresh grading desk layout
        routeTargetStudentToEvaluationDesk(studentId);
    } catch (err) {
        alert(err.message);
    }
}

async function executeInstructorManualScoreOverride(studentId, qId, isApproved) {
    let overrideScoreVal = 0;
    if (isApproved) {
        overrideScoreVal = parseFloat(document.getElementById('inputManualOverrideScore').value);
        if (isNaN(overrideScoreVal) || overrideScoreVal < 0 || overrideScoreVal > 10) {
            return alert("Invalid override score value constraint metrics.");
        }
    }

    try {
        const payload = {
            studentId: studentId,
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
        switchScreen('screen-teacher-dash');
        switchTeacherTab('analytics');
    } catch (err) {
        alert(err.message);
    }
}

// ================= COURSE FORUM SYSTEM =================

async function renderUnifiedForumComponent(targetContainerID, filterTopic) {
    const container = document.getElementById(targetContainerID);
    if (!container) return;

    try {
        const res = await fetch(`${API_BASE}/forum/${filterTopic}`);
        if (!res.ok) throw new Error();
        const comments = await res.json();

        const commentsHTMLStream = comments.map(c => {
            // Check self bubble styling
            const isSelf = c.sender.includes(state.user.name);
            return `
                <div class="comment-bubble ${isSelf ? 'self' : ''}">
                    <span class="d-block small fw-bold" style="color: var(--accent-cyan); font-size: 11px;">${c.sender}</span>
                    <span style="font-size: 12.5px;">${c.message}</span>
                </div>`;
        }).join('');

        container.innerHTML = `
            <div class="glass-panel">
                <h5 class="fw-bold border-bottom border-secondary pb-2 mb-3">💬 Course Forum Hub Room: ${filterTopic}</h5>
                <div class="chat-window">
                    <div class="chat-header">Active Public Discussion Stream (7-Day closing window active)</div>
                    <div class="p-3">
                        <div class="p-2 border rounded text-secondary small text-center mb-3 font-monospace" style="background: rgba(255,255,255,0.015); border-color: var(--border-color) !important;">
                            Pinned Asset Reference: <a href="#" onclick="return false;" class="text-cyan">Course_Basics_Remedial_Blueprint.pdf</a>
                        </div>
                        <div class="chat-message-stream mb-3" style="height: 250px;">
                            ${commentsHTMLStream}
                        </div>
                        <div class="input-group">
                            <input type="text" id="inputLiveCommentTextString" class="form-control" placeholder="Post a query peer comment...">
                            <button class="btn btn-dark-custom" onclick="dispatchLiveCommentSubmission('${targetContainerID}', '${filterTopic}')">Comment</button>
                        </div>
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
        const payload = {
            isPrivate: false,
            studentId: "all",
            topic: filterTopic,
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
