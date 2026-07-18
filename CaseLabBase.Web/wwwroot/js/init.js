

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
        await switchQuizSubTab('view');
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
