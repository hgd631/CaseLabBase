
// 1. DASHBOARD: Load all available quizzes
async function renderStudentDashboard() {
    const box = document.getElementById('assignmentContainerStudent');
    if (!box) return;

    try {
        const resQuizzes = await fetch(`${API_BASE}/questions/quizzes`);
        const quizzes = await resQuizzes.json();
        state.quizzes = quizzes;

        if (quizzes.length === 0) {
            box.innerHTML = `<div class="p-3 text-center text-secondary">No assignments published.</div>`;
            return;
        }

        box.innerHTML = "";
        let totalMistakesCount = 0; // To show on the sidebar badge

        for (const quiz of quizzes) {
            const title = quiz.title || quiz.Title;
            const isInstructorOpen = quiz.isQuizOpen ?? quiz.IsQuizOpen ?? false;
            const deadlineStr = quiz.deadlineString || quiz.DeadlineString;
            let isTimeUp = false;
            if (deadlineStr) {
                const deadlineDate = new Date(deadlineStr);
                if (new Date() > deadlineDate) isTimeUp = true;
            }

            const resBank = await fetch(`${API_BASE}/student/mistake-bank/${state.user.id}?quizTitle=${encodeURIComponent(title)}`);
            let status = "NotStarted";
            let quizFinalScore = 0;

            if (resBank.ok) {
                const data = await resBank.json();
                status = data.status;
                quizFinalScore = data.finalScore;

                // Count mistakes ONLY if isCorrect is strictly false
                if (status === "Graded" && data.answers.some(a => a.isCorrect === false)) {
                    totalMistakesCount++;
                }
            }

            let btnHTML = "";
            if (status === "Pending") {
                btnHTML = `<span class="badge bg-info text-white p-2">Wait for Grading</span>`;
            } else if (status === "Graded") {
                btnHTML = `<button class="btn btn-sm btn-outline-dark" onclick="window.location.href='/Student/MistakeBank?quizTitle=${encodeURIComponent(title)}'">See Review</button>`;
            } else {
                if (isInstructorOpen && !isTimeUp) {
                    btnHTML = `<button class="btn btn-primary btn-sm px-4" onclick="window.location.href='/Student/Exam?quizTitle=${encodeURIComponent(title)}'">Start Exam</button>`;
                } else {
                    let reason = isTimeUp ? "Past Due" : "Closed by Teacher";
                    btnHTML = `<span class="badge bg-secondary text-white p-2">${reason}</span>`;
                }
            }

            box.innerHTML += `
                <div class="border rounded p-3 mb-2 d-flex justify-content-between align-items-center bg-white shadow-sm">
                    <div>
                        <div class="fw-bold text-dark">${title}</div>
                        <div class="small ${isTimeUp ? 'text-danger fw-bold' : 'text-secondary'}">
                            Due: ${deadlineStr ? new Date(deadlineStr).toLocaleString() : 'No deadline'}
                        </div>
                        ${status === "Graded" ? `<div class="small text-primary fw-bold">Result: ${quizFinalScore} pts</div>` : ""}
                    </div>
                    <div>${btnHTML}</div>
                </div>`;
        }

        // Update the badge in the navigation menu
        const badge = document.getElementById('dashMistakeBadge');
        if (badge) badge.innerText = totalMistakesCount;

    } catch (err) { box.innerHTML = "Error loading assignments."; }
}

// 2. EXAM: Load questions for the quiz
async function loadQuestionsForExam(quizTitle) {
    try {
        if (!quizTitle) {
            const urlParams = new URLSearchParams(window.location.search);
            quizTitle = urlParams.get('quizTitle');
        }
        const res = await fetch(`${API_BASE}/questions?quizTitle=${encodeURIComponent(quizTitle)}`);
        const data = await res.json();

        state.activeTaskTitle = data.title;
        state.questions = data.questions;
        state.timeLimitMinutes = data.timeLimitMinutes || 40;

        switchLocalPanel('screen-student-exam');
        document.getElementById('examTitle').innerText = state.activeTaskTitle;

        state.currentExamQuestionIndex = 0;
        state.studentAnswers = {};
        state.flaggedQuestions = {};
        state.examSecondsRemaining = state.timeLimitMinutes * 60;

        startExamTimer();
        renderExamWorkspace();
    } catch (err) { alert("Failed to load quiz."); }
}

// 3. EXAM UI: Render 2-Column Sidebar and Content Area
function renderExamWorkspace() {
    const layoutArea = document.getElementById('examWorkspaceLayoutArea');
    if (!layoutArea) return;

    layoutArea.innerHTML = `
        <div class="col-md-3">
            <div class="p-3 border rounded bg-white shadow-sm">
                <h6 class="fw-bold small mb-3">Questions Navigator</h6>
                <div id="exam-nav-grid" class="d-flex flex-wrap gap-2 mb-4"></div>
                <hr>
                <button class="btn btn-primary btn-sm w-100 fw-bold" onclick="lockExamAndOpenSurvey()">Finish Exam</button>
            </div>
        </div>
        <div class="col-md-9">
            <div id="studentActiveQuestionsArea"></div>
        </div>`;

    updateNavGrid();
    renderCurrentQuestion();
}

// 4. EXAM UI: Navigator Grid (Buttons 1, 2, 3...)
function updateNavGrid() {
    const grid = document.getElementById('exam-nav-grid');
    if (!grid) return;

    grid.innerHTML = state.questions.map((q, idx) => {
        const isCurrent = idx === state.currentExamQuestionIndex;
        const isAnswered = state.studentAnswers[q.id] && state.studentAnswers[q.id].trim().length > 0;
        const isFlagged = state.flaggedQuestions[q.id] === true;

        let color = "white";
        if (isCurrent) color = "#e7f1ff";
        if (isAnswered) color = "#d1e7dd";
        if (isFlagged) color = "#fff3cd";

        return `<button onclick="jumpTo(${idx})" 
                    style="width:35px; height:35px; background-color:${color}; border:1px solid ${isCurrent ? '#0d6efd' : '#ddd'}; font-weight:bold;" 
                    class="rounded small">
                    ${idx + 1}${isFlagged ? '🚩' : ''}
                </button>`;
    }).join('');
}

function jumpTo(index) {
    state.currentExamQuestionIndex = index;
    renderCurrentQuestion();
    updateNavGrid();
}

// 5. EXAM UI: Render current question card
function renderCurrentQuestion() {
    const area = document.getElementById('studentActiveQuestionsArea');
    const q = state.questions[state.currentExamQuestionIndex];
    if (!area || !q) return;

    const isFlagged = state.flaggedQuestions[q.id] === true;

    let html = `
        <div class="p-4 border rounded bg-white shadow-sm">
            <div class="d-flex justify-content-between mb-3">
                <h5 class="fw-bold">Question ${state.currentExamQuestionIndex + 1}</h5>
                <button class="btn btn-sm ${isFlagged ? 'btn-warning' : 'btn-outline-secondary'}" onclick="toggleFlag(${q.id})">
                    ${isFlagged ? '🚩 Flagged' : 'Flag for Review'}
                </button>
            </div>
            <p class="mb-4">${q.prompt}</p>`;

    if (q.type === "MCQ") {
        q.options.forEach(opt => {
            const key = opt.trim().substring(0, 1);
            const isSelected = state.studentAnswers[q.id] === key;
            html += `<div class="p-3 border rounded mb-2" style="cursor:pointer; background-color:${isSelected ? '#e7f1ff' : 'white'}" 
                        onclick="state.studentAnswers[${q.id}]='${key}'; renderCurrentQuestion(); updateNavGrid();">
                        ${opt}
                     </div>`;
        });
    } else {
        html += `<textarea class="form-control" rows="6" placeholder="Type your answer here..." oninput="state.studentAnswers[${q.id}]=this.value; updateNavGrid();">${state.studentAnswers[q.id] || ""}</textarea>`;
    }
    area.innerHTML = html + "</div>";
}

function toggleFlag(qId) {
    state.flaggedQuestions[qId] = !state.flaggedQuestions[qId];
    renderCurrentQuestion();
    updateNavGrid();
}

function startExamTimer() {
    state.examTimerInterval = setInterval(() => {
        state.examSecondsRemaining--;
        if (state.examSecondsRemaining <= 0) { clearInterval(state.examTimerInterval); lockExamAndOpenSurvey(); }
        const min = Math.floor(state.examSecondsRemaining / 60);
        const sec = state.examSecondsRemaining % 60;
        const display = document.getElementById('examTimerDisplay');
        if (display) display.innerText = `${min}:${sec < 10 ? '0' + sec : sec}`;
    }, 1000);
}

function lockExamAndOpenSurvey() {
    clearInterval(state.examTimerInterval);
    switchLocalPanel('screen-student-survey');
}

// 6. SURVEY: Click difficulty and Submit
function selectOverallDifficulty(level) {
    const ids = ['easy', 'medium', 'hard'];
    ids.forEach(id => {
        const btn = document.getElementById(`emoji-${id}-overall`);
        if (btn) {
            btn.style.backgroundColor = "transparent";
            btn.style.border = "1px solid #ddd";
        }
    });
    const selected = document.getElementById(`emoji-${level.toLowerCase()}-overall`);
    if (selected) {
        selected.style.backgroundColor = "#e7f1ff";
        selected.style.border = "2px solid #0d6efd";
    }

    state.studentSurvey.difficulty = level;
}

async function completeSurveyPipeline() {
    const comment = document.getElementById('survey-comment-overall')?.value || "";
    const difficulty = state.studentSurvey.difficulty || "Medium";

    try {
        const answers = state.questions.map(q => ({ questionId: q.id, studentAnswer: state.studentAnswers[q.id] || "" }));

        await fetch(`${API_BASE}/student/submit-exam`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId: state.user.id, quizTitle: state.activeTaskTitle, answers: answers })
        });

        await fetch(`${API_BASE}/student/submit-survey`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId: state.user.id, quizTitle: state.activeTaskTitle, difficulty: difficulty, commentNote: comment })
        });

        alert("Quiz Submitted Successfully!");
        window.location.href = "/Student/Dashboard";
    } catch (e) { alert("Error saving quiz."); }
}

// 7. MISTAKE BANK: Fixed Filter logic
async function openStudentMistakeBankWithReload() {
    const container = document.getElementById('mistakeBankCoreContent');
    if (!container) return;

    try {
        const resQuizzes = await fetch(`${API_BASE}/questions/quizzes`);
        const quizzes = await resQuizzes.json();
        state.quizzes = quizzes;

        if (quizzes.length === 0) {
            container.innerHTML = "<div class='p-5 text-center'>No quizzes found.</div>";
            return;
        }

        let qTitle = state.selectedQuizTitle || quizzes[0].title || quizzes[0].Title;
        state.selectedQuizTitle = qTitle;

        let optionsHTML = quizzes.map(q => {
            const t = q.title || q.Title;
            return `<option value="${t}" ${t === qTitle ? 'selected' : ''}>${t}</option>`;
        }).join('');

        const selectorHTML = `
            <div class="p-3 border rounded bg-light mb-4 d-flex align-items-center justify-content-between shadow-sm">
                <div>
                    <label class="small fw-bold text-secondary d-block">Choose Quiz:</label>
                    <select class="form-select form-select-sm w-auto" onchange="state.selectedQuizTitle=this.value; openStudentMistakeBankWithReload();">
                        ${optionsHTML}
                    </select>
                </div>
                <div class="text-end">
                    <span class="small text-secondary">Currently Reviewing:</span>
                    <div class="fw-bold text-primary">${qTitle}</div>
                </div>
            </div>`;

        const resMistakes = await fetch(`${API_BASE}/student/mistake-bank/${state.user.id}?quizTitle=${encodeURIComponent(qTitle)}`);
        if (!resMistakes.ok) {
            container.innerHTML = selectorHTML + "<div class='p-4 text-center border rounded bg-white'>No grades found for this quiz.</div>";
            return;
        }

        const data = await resMistakes.json();

        
        const incorrect = data.answers.filter(a => a.isCorrect === false);

        let summaryHTML = `
            <div class="mb-3">
                <span class="badge bg-danger p-2 me-1">Mistakes found: ${incorrect.length}</span>
                <span class="float-end fw-bold text-dark">
            Total Score: ${data.finalScore} / ${data.quizMaxScore} pts
        </span>
            </div><hr>`;

        let mistakesHTML = `<h6>Incorrect Items (Mistakes)</h6>`;

        if (incorrect.length === 0) {
            mistakesHTML += `<div class="alert alert-success small text-center py-4">Great job! You have no mistakes in this quiz.</div>`;
        } else {
            incorrect.forEach(q => {
                let mcqHint = "";
                if (q.questionType === "MCQ") {
                    
                    const fullText = q.correctAnswer || "Not available";
                    mcqHint = `<div class="mt-1 small text-success fw-bold">Correct Answer: ${fullText}</div>`;
                }

                mistakesHTML += `
             <div class="border-start border-4 border-danger p-3 bg-white mb-3 shadow-sm rounded">
                 <div class="fw-bold small text-dark">${q.questionPrompt}</div>
                 <div class="small text-muted mt-1">Topic: ${q.questionTopic}</div>
            
             <div class="font-monospace small mt-2">
                Your Answer: ${q.studentAnswer || '[No Answer]'}
            </div>
            ${mcqHint} 

            <div class="mt-2 text-danger small">
                <strong>Teacher Feedback:</strong> ${q.teacherFeedback || 'No specific comments.'}
            </div>
        </div>`;
            });
        }

        container.innerHTML = selectorHTML + summaryHTML + mistakesHTML;

    } catch (e) {
        console.error(e);
        container.innerHTML = "<div class='alert alert-warning'>Error loading review data.</div>";
    }
}