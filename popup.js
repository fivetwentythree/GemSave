document.addEventListener("DOMContentLoaded", async () => {
    // Load existing token
    const result = await chrome.storage.local.get(["githubToken", "lastOperation"]);

    if (result.githubToken) {
        document.getElementById("github-token").value = result.githubToken;
    }

    if (result.lastOperation) {
        updateStatusLog(result.lastOperation);
    }

    // Save token
    document.getElementById("save-token").addEventListener("click", async () => {
        const token = document.getElementById("github-token").value.trim();

        if (!token) {
            updateStatusLog({
                status: "error",
                message: "Please enter a GitHub token",
            });
            return;
        }

        await chrome.storage.local.set({ githubToken: token });
        updateStatusLog({ status: "success", message: "Token saved successfully!" });
    });

    // Clear storage
    document.getElementById("clear-storage").addEventListener("click", async () => {
        await chrome.storage.local.remove(["conversationData", "lastOperation"]);
        updateStatusLog({ status: "success", message: "Cached data cleared!" });
    });
});

function updateStatusLog(operation) {
    const statusLog = document.getElementById("status-log");
    statusLog.textContent = `${operation.timestamp || new Date().toLocaleString()}\n${operation.message}`;
    statusLog.className = `status-log ${operation.status}`;
}
