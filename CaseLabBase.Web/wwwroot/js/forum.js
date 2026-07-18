
async function initializeForumPage() {
    const container = document.getElementById('student-forum-container-target');
    if (!container) return;

    try {
        //  quiz list to build the discussion scope
        if (!state.quizzes || state.quizzes.length === 0) {
            const resQ = await fetch(`${API_BASE}/questions/quizzes`);
            state.quizzes = await resQ.json();
        }

        // Default to first quiz if none selected
        if (!state.activeTaskTitle && state.quizzes.length > 0) {
            state.activeTaskTitle = state.quizzes[0].title || state.quizzes[0].Title;
        }

        //  Create the Dropdown
        let quizOptions = state.quizzes.map(q => {
            const t = q.title || q.Title;
            return `<option value="${t}" ${state.activeTaskTitle === t ? 'selected' : ''}>${t}</option>`;
        }).join('');

        //  Draw the Interface Structure
        container.innerHTML = `
            <div class="p-3 border rounded bg-white mb-3 shadow-sm">
                <label class="small fw-bold text-secondary">1. Choose Quiz Discussion:</label>
                <select class="form-select form-select-sm mt-1" onchange="state.activeTaskTitle=this.value; initializeForumPage();">
                    ${quizOptions}
                </select>
            </div>
            
            <div id="resource-box" class="border-start border-4 border-primary p-3 bg-white mb-3 shadow-sm rounded">
                <h6 class="fw-bold text-primary small">2. Study Materials (Links)</h6>
                <div id="tag-selector-area" class="mb-2"></div>
                <div id="resource-content" class="bg-light p-3 border rounded small text-secondary">
                    Please select an error tag to see resources.
                </div>
            </div>

            <div class="p-3 bg-white border rounded shadow-sm">
                <h6 class="fw-bold small mb-2 text-dark">3. Class Discussion Board</h6>
                <div id="chat-scroller" class="bg-light p-3 border rounded mb-2" style="height: 250px; overflow-y: auto;">
                    <div class="text-center py-4 text-muted small">Loading messages...</div>
                </div>
                <div class="input-group input-group-sm">
                    <input type="text" id="input-chat" class="form-control" placeholder="Ask a question about this quiz...">
                    <button class="btn btn-dark" onclick="sendForumPost('Discussion')">Send</button>
                </div>
            </div>`;

        // Load content into the areas
        loadTagOptions();
        loadDiscussion();

    } catch (err) {
        container.innerHTML = "<div class='alert alert-danger'>Failed to load forum threads.</div>";
    }
}

// Function to load error tags (F1, F2...) into a dropdown
async function loadTagOptions() {
    const area = document.getElementById('tag-selector-area');
    let tags = [];

    try {
        if (state.user.role === 'student') {
            const res = await fetch(`${API_BASE}/student/mistake-bank/${state.user.id}?quizTitle=${encodeURIComponent(state.activeTaskTitle)}`);
            const data = await res.json();
            data.answers.forEach(a => {
                if (a.teacherTag && a.teacherTag !== "Pending" && !tags.includes(a.teacherTag)) tags.push(a.teacherTag);
            });
        } else {
            const res = await fetch(`${API_BASE}/instructor/error-tags`);
            tags = await res.json();
        }

        if (!tags.length) {
            area.innerHTML = "<small class='text-muted italic'>No resource tags found for this topic.</small>";
            return;
        }

        area.innerHTML = `
            <select class="form-select form-select-sm" id="tag-select" onchange="loadTagLinks(this.value)">
                <option value="">-- Choose Error Type (F1, F2...) --</option>
                ${tags.map(t => `<option value="${t}">${t}</option>`).join('')}
            </select>`;
    } catch (e) { area.innerHTML = ""; }
}

// Function to load resource links for a specific tag
async function loadTagLinks(tagName) {
    const content = document.getElementById('resource-content');
    if (!tagName) {
        content.innerHTML = "Please select a tag above.";
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/forum/${encodeURIComponent('Resource - ' + tagName)}`);
        const msgs = await res.json();

        let html = msgs.map(m => `<div class="mb-1 border-bottom py-1">🔗 <a href="${m.message}" target="_blank">${m.message}</a></div>`).join('') || "No study resources posted for this tag yet.";

        if (state.user.role !== 'student') {
            html += `<div class="input-group input-group-sm mt-3">
                        <input type="text" id="input-res" class="form-control" placeholder="Add textbook link or info...">
                        <button class="btn btn-primary" onclick="sendForumPost('Resource', '${tagName}')">Add</button>
                     </div>`;
        }
        content.innerHTML = html;
    } catch (e) { content.innerHTML = "Error loading links."; }
}

// Function to load the main chat
async function loadDiscussion() {
    const box = document.getElementById('chat-scroller');
    const topic = `${state.activeTaskTitle} - Discussion`;

    try {
        const res = await fetch(`${API_BASE}/forum/${encodeURIComponent(topic)}`);
        const msgs = await res.json();

        box.innerHTML = msgs.map(m => `
            <div class="mb-2 p-2 bg-white border rounded shadow-xs small">
                <strong class="${m.sender.includes('Instructor') ? 'text-primary' : 'text-success'}">${m.sender}:</strong> 
                <span>${m.message}</span>
            </div>`).join('') || "<div class='text-center text-muted py-4'>No messages yet. Start the conversation!</div>";

        box.scrollTop = box.scrollHeight;
    } catch (e) { box.innerHTML = "Error loading chat."; }
}

// Global Send Function
async function sendForumPost(type, tag = "") {
    const inputId = type === 'Discussion' ? 'input-chat' : 'input-res';
    const topic = type === 'Discussion' ? `${state.activeTaskTitle} - Discussion` : `Resource - ${tag}`;
    const inputEl = document.getElementById(inputId);
    const msg = inputEl.value.trim();

    if (!msg) return;

    try {
        await fetch(`${API_BASE}/forum/comment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                topic: topic,
                sender: state.user.name + (state.user.role === 'student' ? ' (Student)' : ' (Instructor)'),
                message: msg,
                isPrivate: false,
                studentId: "all"
            })
        });

        inputEl.value = "";
        if (type === 'Discussion') loadDiscussion(); else loadTagLinks(tag);
    } catch (e) { alert("Failed to post message."); }
}