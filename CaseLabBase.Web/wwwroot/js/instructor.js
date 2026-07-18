// HITESH - TAB & SIDEBAR MANAGEMENT 
async function switchTeacherTab(tab) {
    document.querySelectorAll('.teacher-tab-content').forEach(c => c.classList.add('d-none'));
    document.querySelectorAll('#teacherTabs .nav-link-custom').forEach(l => l.classList.remove('active'));

    const target = document.getElementById(`teacher-tab-${tab}`);
    const btn = document.getElementById(`tab-btn-${tab}`);
    if (target) target.classList.remove('d-none');
    if (btn) btn.classList.add('active');

    if (tab === 'analytics') {
        await loadQuizzesSidebar();
        if (state.selectedQuizTitle) {
            document.getElementById('teacherDashboardEmptyPlaceholder')?.classList.add('d-none');
            document.getElementById('quizSelectedViewContainer')?.classList.remove('d-none');
            await switchQuizSubTab(state.activeQuizSubTab || 'view');
        }
    }
    if (tab === 'forum') initializeForumPage();
}

async function loadQuizzesSidebar() {
    const sidebar = document.getElementById('quizListSidebarContainer');
    if (!sidebar) return;
    try {
        const res = await fetch(`${API_BASE}/questions/quizzes`);
        state.quizzes = await res.json();

        sidebar.innerHTML = "";
        state.quizzes.forEach(quiz => {
            const title = quiz.title || quiz.Title;
            const isSelected = state.selectedQuizTitle === title;
            const btn = document.createElement('button');
            btn.className = `btn btn-sm text-start p-2 mb-1 w-100 border ${isSelected ? 'btn-primary text-white' : 'btn-light'}`;
            btn.innerHTML = `<div class="fw-bold small">${title}</div>`;
            btn.onclick = () => selectQuizFromSidebar(title);
            sidebar.appendChild(btn);
        });
    } catch (err) { sidebar.innerHTML = "Error loading sidebar."; }
}

async function selectQuizFromSidebar(title) {
    state.selectedQuizTitle = title;
    const quiz = state.quizzes.find(q => (q.title || q.Title) === title);
    if (quiz) {
        state.activeTaskTitle = title;
        state.totalScore = quiz.totalScore || 10.0;
    }

    document.getElementById('teacherDashboardEmptyPlaceholder')?.classList.add('d-none');
    document.getElementById('quizCreateViewContainer')?.classList.add('d-none');
    document.getElementById('quizSelectedViewContainer')?.classList.remove('d-none');
    document.getElementById('activeQuizTitleHeader').innerText = title;

    await loadQuizzesSidebar();
    await switchQuizSubTab(state.activeQuizSubTab || 'view');
}

function enterCreateQuizMode() {
    state.selectedQuizTitle = null;
    document.getElementById('teacherDashboardEmptyPlaceholder')?.classList.add('d-none');
    document.getElementById('quizSelectedViewContainer')?.classList.add('d-none');
    document.getElementById('quizCreateViewContainer')?.classList.remove('d-none');

    document.getElementById('inputTaskTitle').value = "";
    document.getElementById('custom-questions-list-container').innerHTML = "";
}

async function switchQuizSubTab(subTab) {
    state.activeQuizSubTab = subTab;
    document.querySelectorAll('.quiz-sub-tab-content').forEach(c => c.classList.add('d-none'));
    document.querySelectorAll('#quizSubTabs .nav-link-custom').forEach(l => l.classList.remove('active'));

    document.getElementById(`quiz-sub-btn-${subTab}`)?.classList.add('active');
    document.getElementById(`quiz-sub-tab-content-${subTab}`)?.classList.remove('d-none');

    if (subTab === 'view') await renderViewQuizQuestions();
    else if (subTab === 'grading') await switchRosterSubTab(state.activeRosterSubTab || 'pending');
    else if (subTab === 'diagnostics') await loadInstructorAnalytics();
}

// HAN - QUIZ CREATION 
function addCustomQuestionField(type) {
    const container = document.getElementById('custom-questions-list-container');
    const qId = Date.now();
    const card = document.createElement('div');
    card.className = "p-3 border rounded mb-3 bg-white shadow-sm";
    card.setAttribute('data-type', type);

    let html = `
        <div class="d-flex justify-content-between mb-2 small fw-bold text-secondary">
            <span>New Question (${type})</span>
            <button class="btn btn-sm text-danger p-0" onclick="this.closest('.border').remove()">Remove</button>
        </div>
        <input type="text" class="form-control form-control-sm mb-2 custom-q-prompt" placeholder="Question prompt" required>
        <div class="row g-2">
            <div class="col-6"><input type="number" class="form-control form-control-sm custom-q-score" value="5.0" step="0.1"></div>
            <div class="col-6"><input type="text" class="form-control form-control-sm custom-q-topic" placeholder="Topic Tag"></div>
        </div>`;

    if (type === 'MCQ') {
        html += `<div class="mt-2 p-2 bg-light rounded border small">
            <div class="row g-1 mb-1">
                <div class="col-6">A: <input type="text" class="form-control form-control-sm custom-q-optA"></div>
                <div class="col-6">B: <input type="text" class="form-control form-control-sm custom-q-optB"></div>
                <div class="col-6">C: <input type="text" class="form-control form-control-sm custom-q-optC"></div>
                <div class="col-6">D: <input type="text" class="form-control form-control-sm custom-q-optD"></div>
            </div>
            Correct Key: <select class="form-select form-select-sm custom-q-key d-inline-block w-auto ms-1"><option>A</option><option>B</option><option>C</option><option>D</option></select>
        </div>`;
    }
    card.innerHTML = html;
    container.appendChild(card);
}

async function instructorPublishTask() {
    const title = document.getElementById('inputTaskTitle').value;
    if (!title) return alert("Please enter a title.");

    const questionNodes = document.querySelectorAll('#custom-questions-list-container > .border');
    const questions = [];

    questionNodes.forEach(node => {
        const type = node.getAttribute('data-type');
        let options = null;
        if (type === 'MCQ') {
            options = [
                "A. " + node.querySelector('.custom-q-optA').value,
                "B. " + node.querySelector('.custom-q-optB').value,
                "C. " + node.querySelector('.custom-q-optC').value,
                "D. " + node.querySelector('.custom-q-optD').value
            ];
        }
        questions.push({
            type: type,
            prompt: node.querySelector('.custom-q-prompt').value,
            maxScore: parseFloat(node.querySelector('.custom-q-score').value),
            topic: node.querySelector('.custom-q-topic').value || "General",
            options: options,
            correctKey: type === 'MCQ' ? node.querySelector('.custom-q-key').value : "Essay Evaluation"
        });
    });

    await fetch(`${API_BASE}/questions/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            title: title,
            questions: questions,
            timeLimitMinutes: parseInt(document.getElementById('inputQuizTimeLimit').value),
            deadlineString: document.getElementById('inputQuizDeadline').value
        })
    });
    alert("Quiz Published!");
    location.reload();
}

// SONI - VIEW & EDIT ASSIGNED QUESTIONS 
async function renderViewQuizQuestions() {
    const container = document.getElementById('viewQuizQuestionsContainer');
    if (!container) return;

    try {
        const res = await fetch(`${API_BASE}/questions?quizTitle=${encodeURIComponent(state.selectedQuizTitle)}`);
        const data = await res.json();

        // 1. Settings Panel (Deadline, Time, etc.)
        let html = `
            <div class="border p-3 mb-4 bg-light rounded shadow-sm">
                <h6 class="fw-bold mb-3 small text-uppercase">Quiz Parameters</h6>
                <div class="row g-3">
                    <div class="col-md-4">
                        <label class="small fw-bold">Deadline</label>
                        <input type="datetime-local" class="form-control form-control-sm" id="edit-quiz-deadline" value="${data.deadlineString ? data.deadlineString.slice(0, 16) : ''}">
                    </div>
                    <div class="col-md-3">
                        <label class="small fw-bold">Time (Mins)</label>
                        <input type="number" class="form-control form-control-sm" id="edit-quiz-timelimit" value="${data.timeLimitMinutes}">
                    </div>
                    <div class="col-md-5 d-flex align-items-end gap-3">
                        <div class="form-check form-switch small">
                            <input class="form-check-input" type="checkbox" id="edit-quiz-isopen" ${data.isQuizOpen ? 'checked' : ''}> Open
                        </div>
                        <button class="btn btn-sm btn-primary ms-auto" onclick="saveActiveQuizSettings()">Save Settings</button>
                    </div>
                </div>
            </div>`;

        // 2. Loop through questions
        data.questions.forEach((q, idx) => {
            html += `
            <div class="p-3 border rounded bg-white mb-3 shadow-sm">
                <div class="fw-bold small mb-2 text-primary">Question #${idx + 1} (${q.type})</div>
                <input type="text" class="form-control form-control-sm mb-2" id="edit-q-prompt-${q.id}" value="${q.prompt}">
                
                <div class="row g-2 mb-2">
                    <div class="col-6"><label class="small fw-bold">Weight</label><input type="number" class="form-control form-control-sm" id="edit-q-score-${q.id}" value="${q.maxScore}"></div>
                    <div class="col-6"><label class="small fw-bold">Topic</label><input type="text" class="form-control form-control-sm" id="edit-q-topic-${q.id}" value="${q.topic}"></div>
                </div>`;

            if (q.type === 'MCQ') {
                const opts = q.options || ["A. ", "B. ", "C. ", "D. "];
                html += `
                <div class="row g-2 small mt-2">
                    <div class="col-6">A: <input type="text" class="form-control form-control-sm" id="edit-q-optA-${q.id}" value="${opts[0].replace('A. ', '')}"></div>
                    <div class="col-6">B: <input type="text" class="form-control form-control-sm" id="edit-q-optB-${q.id}" value="${opts[1].replace('B. ', '')}"></div>
                    <div class="col-6">C: <input type="text" class="form-control form-control-sm" id="edit-q-optC-${q.id}" value="${opts[2].replace('C. ', '')}"></div>
                    <div class="col-6">D: <input type="text" class="form-control form-control-sm" id="edit-q-optD-${q.id}" value="${opts[3].replace('D. ', '')}"></div>
                </div>
                
                <!-- FIX: Added Dropdown to show and change the Correct Answer -->
                <div class="mt-2 bg-light p-2 rounded border">
                    <label class="small fw-bold text-success">Correct Answer Key:</label>
                    <select class="form-select form-select-sm d-inline-block w-auto ms-2" id="edit-q-key-${q.id}">
                        <option value="A" ${q.correctKey === 'A' ? 'selected' : ''}>Option A</option>
                        <option value="B" ${q.correctKey === 'B' ? 'selected' : ''}>Option B</option>
                        <option value="C" ${q.correctKey === 'C' ? 'selected' : ''}>Option C</option>
                        <option value="D" ${q.correctKey === 'D' ? 'selected' : ''}>Option D</option>
                    </select>
                </div>`;
            }

            html += `<button class="btn btn-sm btn-outline-dark mt-3 w-100" onclick="saveQuestionChanges(${q.id}, '${q.type}')">Update This Question</button>
            </div>`;
        });
        container.innerHTML = html;
    } catch (e) { container.innerHTML = "Error loading."; }
}


async function saveActiveQuizSettings() {
    const payload = {
        title: state.selectedQuizTitle,
        timeLimitMinutes: parseInt(document.getElementById('edit-quiz-timelimit').value),
        isQuizOpen: document.getElementById('edit-quiz-isopen').checked,
        deadlineString: document.getElementById('edit-quiz-deadline').value
    };
    await fetch(`${API_BASE}/questions/update-settings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    alert("Settings saved.");
}

async function saveQuestionChanges(qId, type) {
    const payload = {
        id: qId,
        prompt: document.getElementById(`edit-q-prompt-${qId}`).value,
        maxScore: parseFloat(document.getElementById(`edit-q-score-${qId}`).value),
        topic: document.getElementById(`edit-q-topic-${qId}`).value,
        // Get the key from the new select dropdown
        correctKey: type === 'MCQ' ? document.getElementById(`edit-q-key-${qId}`).value : "Essay Evaluation"
    };

    if (type === 'MCQ') {
        payload.options = [
            "A. " + document.getElementById(`edit-q-optA-${qId}`).value,
            "B. " + document.getElementById(`edit-q-optB-${qId}`).value,
            "C. " + document.getElementById(`edit-q-optC-${qId}`).value,
            "D. " + document.getElementById(`edit-q-optD-${qId}`).value
        ];
    }

    try {
        const res = await fetch(`${API_BASE}/questions/update-question`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) alert("Question updated successfully!");
        else alert("Failed to update.");
    } catch (e) { alert("Error connecting to API."); }
}

// HITESH - STATISTICS & ANALYTICS 
async function loadInstructorAnalytics() {
    try {
        const res = await fetch(`${API_BASE}/instructor/analytics?quizTitle=${encodeURIComponent(state.selectedQuizTitle)}`);
        const data = await res.json();
        document.getElementById('analyticsSubmissionCount').innerText = data.totalSubmissionsCount;
        document.getElementById('analyticsFailureRate').innerText = data.failureRatePercentage + "%";
        document.getElementById('classAvgLabelField').innerText = "Avg Score: " + data.classAverageScore;
        await loadQuestionDiagnostics();
    } catch (e) { console.error(e); }
}

async function loadQuestionDiagnostics() {
    const container = document.getElementById('analyticsQuestionDiagnosticsContainer');
    try {
        const res = await fetch(`${API_BASE}/instructor/roster?subTab=all&quizTitle=${encodeURIComponent(state.selectedQuizTitle)}`);
        const submissions = await res.json();

        let high = 0, avg = 0, low = 0;
        let reflectionsHTML = "";
        let flagsHTML = "";
        const max = state.totalScore || 10.0;

        submissions.forEach(s => {
            const score = s.finalScore || 0;
            const diff = s.surveyDifficulty || "Medium";
            if (score >= 0.8 * max) high++; else if (score >= 0.5 * max) avg++; else low++;
            if (score >= 0.8 * max && diff === "Hard") {
                flagsHTML += `<div class="small text-danger mb-1 border-start border-3 border-danger ps-2"><strong>${s.studentName}</strong> scored high but rated <strong>Hard</strong>.</div>`;
            }
            if (s.surveyPainPoint) reflectionsHTML += `<div class="small border-bottom py-2"><strong>${s.studentName}:</strong> "${s.surveyPainPoint}" <span class="badge bg-light text-dark border float-end">${diff}</span></div>`;
        });

        container.innerHTML = `
            <div class="row g-3 mb-4">
                <div class="col-md-4"><div class="border p-2 rounded text-center bg-white shadow-sm"><strong>High (>=80%)</strong><br>${high} Students</div></div>
                <div class="col-md-4"><div class="border p-2 rounded text-center bg-white shadow-sm"><strong>Average</strong><br>${avg} Students</div></div>
                <div class="col-md-4"><div class="border p-2 rounded text-center bg-white shadow-sm"><strong>Low (<50%)</strong><br>${low} Students</div></div>
            </div>
            <div class="border p-3 rounded bg-white shadow-sm mb-4"><h6>⚠️ Pacing Metric Anomalies</h6>${flagsHTML || '<div class="small text-muted">No anomalies.</div>'}</div>
            <div class="border p-3 rounded bg-white shadow-sm"><h6>Student Reflections</h6>${reflectionsHTML || '<div class="small text-muted">No feedback.</div>'}</div>`;
    } catch (e) { container.innerHTML = "No diagnostics available."; }
}

// ================= ROSTER & GRADING =================
function switchRosterSubTab(subTab) {
    state.activeRosterSubTab = subTab;
    document.querySelectorAll('.sub-tab-link').forEach(l => l.classList.remove('active'));
    document.getElementById(`sub-btn-${subTab}`)?.classList.add('active');
    renderMultiStudentRosterTable();
}

async function renderMultiStudentRosterTable() {
    const tbody = document.getElementById('multiStudentRosterTableBody');
    if (!tbody) return;
    try {
        const titleQuery = `&quizTitle=${encodeURIComponent(state.selectedQuizTitle)}`;
        const res = await fetch(`${API_BASE}/instructor/roster?subTab=${state.activeRosterSubTab}${titleQuery}`);
        const roster = await res.json();

        if (roster.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center p-4 small text-muted">No submissions found.</td></tr>';
            return;
        }

        tbody.innerHTML = roster.map(s => {
            const btnText = s.status === 'Graded' ? 'Review' : 'Grade';
            const btnClass = s.status === 'Graded' ? 'btn-outline-dark' : 'btn-dark';
            const link = `/Instructor/Grading?studentId=${s.studentId}&quizTitle=${encodeURIComponent(state.selectedQuizTitle)}`;
            return `
                <tr>
                    <td class="align-middle fw-bold text-dark">${s.studentName}</td>
                    <td class="align-middle text-center text-primary fw-bold font-monospace">${s.studentId}</td>
                    <td class="align-middle small text-secondary text-truncate" style="max-width: 250px;">${s.surveyPainPoint || '-'}</td>
                    <td class="align-middle text-center fw-bold ${s.status === 'Graded' ? 'text-primary' : 'text-muted'}">${s.status === 'Graded' ? s.finalScore + ' pts' : '--'}</td>
                    <td class="align-middle text-center"><button class="btn btn-sm ${btnClass} px-3" onclick="window.location.href='${link}'">${btnText}</button></td>
                </tr>`;
        }).join('');
    } catch (e) { tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger p-3">Error loading roster.</td></tr>'; }
}

// SONI - GRADING DESK
async function routeTargetStudentToEvaluationDesk(studentId) {
    state.activeGradingStudentID = studentId;
    try {
        const res = await fetch(`${API_BASE}/student/mistake-bank/${studentId}?quizTitle=${encodeURIComponent(state.selectedQuizTitle)}`);
        const studentObj = await res.json();

        // 1. Render the main workspace layout
        document.getElementById('gradingWorkspaceLayoutArea').innerHTML = `
            <div class="col-lg-10 mx-auto">
                <div class="border p-3 mb-4 bg-light rounded small shadow-sm">
                    <h6 class="fw-bold">Student Survey Info</h6>
                    <strong>Difficulty:</strong> ${studentObj.surveyDifficulty || 'N/A'} | 
                    <strong>Comment:</strong> "${studentObj.surveyPainPoint || 'No notes.'}"
                </div>
                <div class="p-4 border rounded bg-white shadow-sm">
                    <h5 class="fw-bold border-bottom pb-2 mb-3">Grading: ${studentObj.studentName}</h5>
                    <div id="gradingQuestionsLoopContainer"></div>
                    <button class="btn btn-primary w-100 fw-bold mt-4 py-2" onclick="instructorSubmitEvaluation()">Submit Grade Results</button>
                </div>
            </div>`;

        // 2. Load existing tags from database
        const tagRes = await fetch(`${API_BASE}/instructor/error-tags`);
        state.errorTags = await tagRes.json();
        if (state.errorTags.length === 0) state.errorTags = ["[F1] Wrong Word", "[F2] Logic Error"];

        // 3. Render each question
        const loop = document.getElementById('gradingQuestionsLoopContainer');
        studentObj.answers.forEach((a, idx) => {
            let row = `<div class="mb-4 p-3 border rounded">
                <div class="small fw-bold text-secondary mb-1">Q${idx + 1} - ${a.questionTopic}</div>
                <div class="small mb-2 fw-bold">${a.questionPrompt}</div>
                <div class="p-2 bg-dark text-white rounded font-monospace small mb-3">Student Answer: ${a.studentAnswer || '[No Answer]'}</div>`;

            if (a.questionType === "Essay") {
                row += `
                    <div class="row g-2 mb-3">
                        <div class="col-3">Score: <input type="number" step="0.1" class="form-control form-control-sm grading-score-input" data-qid="${a.questionId}" value="${a.earnedScore}"></div>
                        <div class="col-9">Feedback: <input type="text" class="form-control form-control-sm" id="feedback-note-${a.questionId}" value="${a.teacherFeedback || ''}"></div>
                    </div>
                    <div class="mb-2">
                        <label class="small fw-bold d-block mb-2">Select Error Tag:</label>
                        <div id="tags-list-${a.questionId}" class="mb-2">
                            ${state.errorTags.map(t => `<button class="btn btn-xs btn-outline-danger me-1 mb-1 tag-btn-${a.questionId}" style="font-size:11px;" onclick="selectTag(${a.questionId},'${t}',this)">${t}</button>`).join('')}
                        </div>
                        
                        <!-- RE-ADDED: Create New Tag Input -->
                        <div class="input-group input-group-sm w-75 mt-2">
                            <input type="text" id="new-tag-input-${a.questionId}" class="form-control" placeholder="Create new tag (e.g. [F3] Syntax)">
                            <button class="btn btn-outline-secondary" onclick="addNewTagToBank(${a.questionId})">Add Tag</button>
                        </div>
                        
                        <input type="hidden" id="tag-val-${a.questionId}" class="grading-tag-input" value="${a.teacherTag || ''}">
                    </div>`;
            } else {
                row += `<div class="small italic text-secondary">Auto-graded: ${a.earnedScore} pts</div>
                        <input type="hidden" class="grading-score-input" data-qid="${a.questionId}" value="${a.earnedScore}">`;
            }
            row += `</div>`;
            loop.innerHTML += row;
        });
    } catch (err) { alert("Error loading student data."); }
}

//highlight selected tag
function selectTag(qId, tag, btn) {
    document.querySelectorAll(`.tag-btn-${qId}`).forEach(b => {
        b.style.backgroundColor = "white";
        b.style.color = "#ef4444"; // standard red
    });
    btn.style.backgroundColor = "#ef4444";
    btn.style.color = "white";
    document.getElementById(`tag-val-${qId}`).value = tag;
}

//  save a new error tag to the global bank
async function addNewTagToBank(qId) {
    const input = document.getElementById(`new-tag-input-${qId}`);
    const tagName = input.value.trim();
    if (!tagName) return;

    try {
        await fetch(`${API_BASE}/instructor/error-tags`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tagName)
        });

        // Refresh the grading desk to show the new tag button for all questions
        routeTargetStudentToEvaluationDesk(state.activeGradingStudentID);
    } catch (e) { alert("Failed to add new tag."); }
}

async function instructorSubmitEvaluation() {
    const grades = Array.from(document.querySelectorAll('.grading-score-input')).map(input => {
        const qId = input.getAttribute('data-qid');
        return {
            questionId: parseInt(qId),
            earnedScore: parseFloat(input.value),
            teacherFeedback: document.getElementById(`feedback-note-${qId}`)?.value || "",
            chosenTag: document.getElementById(`tag-val-${qId}`)?.value || null
        };
    });

    await fetch(`${API_BASE}/instructor/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: state.activeGradingStudentID, quizTitle: state.selectedQuizTitle, grades: grades })
    });
    alert("Evaluation published successfully.");
    window.location.href = "/Instructor/Dashboard";
}