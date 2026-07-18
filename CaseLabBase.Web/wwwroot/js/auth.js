

//Han: Implement notification polling, dropdown UI, and mark-all-read functionality.
async function loginAsRole(userId) {
    try {
        const res = await fetch(`${API_BASE}/auth/users/${userId}`);
        if (!res.ok) throw new Error("Could not log in user.");

        state.user = await res.json();
        SafeStorage.setItem('caselab_user', JSON.stringify(state.user));

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
    SafeStorage.removeItem('caselab_user');
    clearInterval(state.examTimerInterval);
    clearInterval(state._notifPollInterval);
    window.location.href = "/";
}

// ================= NOTIFICATION SYSTEM =================

async function fetchNotifications() {
    if (!state.user) return;
    try {
        const res = await fetch(`${API_BASE}/notifications/${state.user.id}`);
        if (!res.ok) return;
        const list = await res.json();

        const badge = document.getElementById('notificationBadgeCount');
        const listContainer = document.getElementById('notificationListDropdownContainer');

        const unreadCount = list.filter(n => !n.isRead).length;

        if (badge) {
            if (unreadCount > 0) {
                badge.innerText = unreadCount;
                badge.style.display = "inline-block";
            } else {
                badge.style.display = "none";
            }
        }

        if (listContainer) {
            if (list.length === 0) {
                listContainer.innerHTML = `<div class="p-3 text-center text-secondary small">No notifications yet.</div>`;
                return;
            }

            listContainer.innerHTML = list.map(n => `
                <div class="notification-item p-2.5 border-bottom ${n.isRead ? 'read' : 'unread'}" onclick="clickNotification(${n.id}, '${n.linkUrl}')" style="cursor: pointer;">
                    <div class="small fw-bold text-dark">${n.title}</div>
                    <div class="small text-secondary mt-0.5">${n.message}</div>
                </div>
            `).join('');
        }
    } catch (err) {
        console.error("Failed to fetch notifications: ", err);
    }
}

async function clickNotification(id, linkUrl) {
    try {
        await fetch(`${API_BASE}/notifications/read/${id}`, { method: 'POST' });
        window.location.href = linkUrl;
    } catch (err) {
        window.location.href = linkUrl;
    }
}

function toggleNotifDropdown() {
    const el = document.getElementById('notificationDropdownMenu');
    if (el) {
        el.classList.toggle('show');
    }
}

async function markAllNotifsRead() {
    if (!state.user) return;
    try {
        await fetch(`${API_BASE}/notifications/read-all/${state.user.id}`, { method: 'POST' });
        await fetchNotifications();
    } catch (err) {
        console.error(err);
    }
}

// Start polling for notifications every 10 seconds
function startNotificationPolling() {
    fetchNotifications();
    state._notifPollInterval = setInterval(fetchNotifications, 10000);
}
