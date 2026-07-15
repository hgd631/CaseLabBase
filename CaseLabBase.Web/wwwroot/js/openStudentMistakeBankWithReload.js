const { API_BASE, state } = require("./app");

// ================= STUDENT MISTAKE BANK =================
export async function openStudentMistakeBankWithReload() {
    // Team Member 2: Kelly - Query student evaluation logs for active mistake checks, compiling correct/incorrect answer states.
    try {
        //request mistake bank data from API
        const res = await fetch(
            `${API_BASE}/student/mistake-bank/${state.user.id}?quizTitle=${encodeURIComponent(state.activeTaskTitle)}`
        );
        //stop if the request fails
        if (!res.ok) {
            throw new Error("Failed to load mistake bank data.");
        }

        //store returned mistake bank data in state
        const mistakeBankData = await res.json();
        state.mistakeBankData = mistakeBankData;

        //get mistake bank container and clear it
        const container = document.getElementById('studentMistakeBankContainer');
        container.innerHTML = "";

        //create a card for each question in the mistake bank
        mistakeBankData.answers.forEach(answer => {

            const card = document.createElement('div');
            card.className = "mistake-card ";
            //add correct/incorrect styling based on the answer's correctness
            card.innerHTML = "
                < h4 > Question; ' + answer.questionPrompt + '; h4 >
                    <><p>Question: ${answer.questionsPayload}</p><p>Your Answer: ${answer, studentANswer}</p><p>Correct: ${answer.isCorrect ? "Yes" : "No"}</p></>;
            " ;
            container.appendChild(card);
        });

    } catch (err) {
        console.error(err);
        alert("Unable to load mistake bank: " + err.message);
    }
}
