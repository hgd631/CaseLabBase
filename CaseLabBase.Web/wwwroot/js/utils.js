
function parseLocalDateString(dateStr) {
    if (!dateStr) return null;
    try {
        if (!dateStr.endsWith("Z") && !dateStr.includes("+") && !dateStr.includes("-")) {
            return new Date(dateStr + "Z");
        }
        return new Date(dateStr);
    } catch (e) {
        return null;
    }
}

function formatLocalDateTime(dateStr) {
    if (!dateStr) return "";
    const d = parseLocalDateString(dateStr);
    if (!d || isNaN(d.getTime())) return "";

    // Adjust from UTC to local display format (yyyy-MM-ddThh:mm)
    const tzOffset = d.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(d.getTime() - tzOffset)).toISOString().slice(0, 16);
    return localISOTime;
}

function formatInReginaTimezone(dateStr) {
    if (!dateStr) return "";
    const d = parseLocalDateString(dateStr);
    if (!d || isNaN(d.getTime())) return "";

    // Convert date string representation to user local display string
    return d.toLocaleString("en-US", {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
}

function convertReginaToUtcIso(val) {
    if (!val) return null;
    const d = new Date(val);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
}

function getStudyGuideForTopic(topic) {
    const database = {
        "Math Basics": "📚 Review Elementary Math Guide: Practice addition, subtraction, multiplication, and order of operations.",
        "Algebra": "📚 Review Algebra Foundations: Practice solving for variables, simplifying expressions, and linear equations.",
        "General": "📚 General Remedial Blueprint: Double check calculation steps, verify units, and review core guidelines."
    };
    return database[topic] || database["General"];
}
