// background.js - Simplified to work with markdown directly
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "copyToClipboard") {
        handleCopyToClipboard(request.markdown)
            .then((result) => sendResponse(result))
            .catch((error) => sendResponse({ success: false, error: error.message }));
        return true;
    }

    if (request.action === "shareToGist") {
        handleShareToGist(request.markdown)
            .then((result) => sendResponse(result))
            .catch((error) => sendResponse({ success: false, error: error.message }));
        return true;
    }
});

async function handleCopyToClipboard(markdown) {
    try {
        // Try using offscreen document
        await chrome.offscreen.createDocument({
            url: "offscreen.html",
            reasons: ["CLIPBOARD"],
            justification: "Copy markdown to clipboard",
        });

        await chrome.runtime.sendMessage({
            target: "offscreen",
            action: "copy",
            data: markdown,
        });

        await chrome.offscreen.closeDocument();
        return { success: true };
    } catch (error) {
        // Fallback: inject into active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (text) => navigator.clipboard.writeText(text),
            args: [markdown],
        });
        return { success: true };
    }
}

async function handleShareToGist(markdown) {
    const { token } = await chrome.storage.sync.get(["token"]);

    if (!token) {
        throw new Error(
            "GitHub token not configured. Click the extension icon to set it up.",
        );
    }

    const response = await fetch("https://api.github.com/gists", {
        method: "POST",
        headers: {
            Authorization: `token ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            description: `Gemini Conversation - ${new Date().toISOString()}`,
            public: false,
            files: {
                "conversation.md": { content: markdown },
            },
        }),
    });

    if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
    }

    const gist = await response.json();
    return { success: true, url: gist.html_url };
}
