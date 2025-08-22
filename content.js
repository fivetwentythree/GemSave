// Inject the network interceptor script
function injectInterceptor() {
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("interceptor.js");
    script.onload = function () {
        this.remove();
    };
    (document.head || document.documentElement).appendChild(script);
}

// Listen for data from the interceptor
window.addEventListener("gemini-conversation-data", (event) => {
    chrome.storage.local.set({
        conversationData: event.detail,
        capturedAt: new Date().toISOString(),
    });
});

// Add UI buttons
function addShareButtons() {
    // Wait for the header to be available
    const observer = new MutationObserver((mutations, obs) => {
        const header = document.querySelector(
            'header, [role="banner"], .header-container',
        );
        if (header && !document.querySelector(".gemini-save-buttons")) {
            obs.disconnect();
            injectButtons(header);
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
    });
}

function injectButtons(header) {
    const buttonContainer = document.createElement("div");
    buttonContainer.className = "gemini-save-buttons";

    // Share to Gist button
    const shareButton = document.createElement("button");
    shareButton.className = "gemini-save-btn";
    shareButton.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
            <polyline points="16 6 12 2 8 6"/>
            <line x1="12" y1="2" x2="12" y2="15"/>
        </svg>
        <span>Share to Gist</span>
    `;
    shareButton.onclick = () => handleAction("share");

    // Copy button
    const copyButton = document.createElement("button");
    copyButton.className = "gemini-save-btn";
    copyButton.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
        <span>Copy</span>
    `;
    copyButton.onclick = () => handleAction("copy");

    buttonContainer.appendChild(shareButton);
    buttonContainer.appendChild(copyButton);

    // Find the best place to insert buttons
    const actionArea =
        header.querySelector('.actions, .toolbar, [role="toolbar"]') || header;
    actionArea.appendChild(buttonContainer);
}

async function handleAction(action) {
    try {
        const response = await chrome.runtime.sendMessage({
            action: action,
            url: window.location.href,
        });

        if (response.success) {
            showNotification(response.message, "success");

            if (action === "copy" && response.markdown) {
                await navigator.clipboard.writeText(response.markdown);
            }
        } else {
            showNotification(response.message || "Operation failed", "error");
        }
    } catch (error) {
        showNotification("Error: " + error.message, "error");
    }
}

function showNotification(message, type = "info") {
    const notification = document.createElement("div");
    notification.className = `gemini-save-notification ${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add("show");
    }, 10);

    setTimeout(() => {
        notification.classList.remove("show");
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Initialize
injectInterceptor();
addShareButtons();
