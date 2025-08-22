// content.js - Simplified version using direct URL approach
console.log("[GeminiSave] Content script loaded");

// Extract prompt ID from URL
function getPromptId() {
    const url = window.location.href;
    const match = url.match(/\/prompts\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
}

// Inject buttons
function injectButtons() {
    if (document.querySelector(".gemini-save-buttons")) {
        return;
    }

    const targetElement = document.querySelector(
        'header, [role="banner"], nav, .header-container',
    );
    if (!targetElement) {
        setTimeout(injectButtons, 1000);
        return;
    }

    const buttonContainer = document.createElement("div");
    buttonContainer.className = "gemini-save-buttons";
    buttonContainer.innerHTML = `
    <button id="gemini-copy-btn" class="gemini-save-btn" title="Copy conversation to clipboard">
      📋 Copy Markdown
    </button>
    <button id="gemini-share-btn" class="gemini-save-btn" title="Share to GitHub Gist">
      🔗 Share to Gist
    </button>
    <button id="gemini-export-btn" class="gemini-save-btn" title="Export as Markdown file">
      💾 Export
    </button>
  `;

    targetElement.appendChild(buttonContainer);

    document.getElementById("gemini-copy-btn").addEventListener("click", handleCopy);
    document.getElementById("gemini-share-btn").addEventListener("click", handleShare);
    document
        .getElementById("gemini-export-btn")
        .addEventListener("click", handleExport);

    console.log("[GeminiSave] Buttons injected");
}

// Extract conversation data from the page
async function extractConversationData() {
    const promptId = getPromptId();
    console.log("[GeminiSave] Prompt ID:", promptId);

    if (!promptId) {
        // Try to extract from the page DOM
        return extractFromDOM();
    }

    // Try to fetch data using the prompt ID
    try {
        // Method 1: Try to get from page's __NEXT_DATA__ or similar
        const scriptTags = document.querySelectorAll(
            'script[type="application/json"], script[id*="data"]',
        );
        for (const script of scriptTags) {
            try {
                const data = JSON.parse(script.textContent);
                if (data && (data.props || data.pageProps || data.conversation)) {
                    console.log("[GeminiSave] Found data in script tag:", data);
                    return data;
                }
            } catch (e) {}
        }

        // Method 2: Extract from DOM
        return extractFromDOM();
    } catch (error) {
        console.error("[GeminiSave] Error extracting data:", error);
        return null;
    }
}

// Extract conversation from DOM elements
function extractFromDOM() {
    console.log("[GeminiSave] Extracting from DOM...");

    const conversation = [];

    // Try different selectors for conversation elements
    const selectors = [
        '[data-test-id*="message"]',
        '[role="article"]',
        ".conversation-turn",
        ".message-content",
        '[class*="message"]',
        '[class*="turn"]',
        '[class*="prompt"]',
        '[class*="response"]',
        "div[contenteditable]",
        ".model-response",
        ".user-input",
    ];

    // Find all message containers
    let messageElements = [];
    for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
            messageElements = elements;
            console.log(
                `[GeminiSave] Found ${elements.length} elements with selector: ${selector}`,
            );
            break;
        }
    }

    // If no specific message elements found, try to parse the visible text
    if (messageElements.length === 0) {
        // Get all text content from main content area
        const mainContent = document.querySelector(
            'main, [role="main"], .main-content, #root',
        );
        if (mainContent) {
            const textBlocks = [];
            const walker = document.createTreeWalker(
                mainContent,
                NodeFilter.SHOW_TEXT,
                {
                    acceptNode: function (node) {
                        const text = node.textContent.trim();
                        if (
                            text.length > 10 &&
                            !node.parentElement.closest("script, style, nav, header")
                        ) {
                            return NodeFilter.FILTER_ACCEPT;
                        }
                        return NodeFilter.FILTER_SKIP;
                    },
                },
            );

            let node;
            while ((node = walker.nextNode())) {
                textBlocks.push(node.textContent.trim());
            }

            // Group text blocks into conversation
            let currentMessage = "";
            for (const text of textBlocks) {
                if (
                    text.toLowerCase().includes("you:") ||
                    text.toLowerCase().includes("user:")
                ) {
                    if (currentMessage) {
                        conversation.push({
                            role: "assistant",
                            content: currentMessage,
                        });
                    }
                    currentMessage = text.replace(/^(you:|user:)/i, "").trim();
                    conversation.push({ role: "user", content: currentMessage });
                    currentMessage = "";
                } else if (
                    text.toLowerCase().includes("model:") ||
                    text.toLowerCase().includes("assistant:") ||
                    text.toLowerCase().includes("gemini:")
                ) {
                    currentMessage = text
                        .replace(/^(model:|assistant:|gemini:)/i, "")
                        .trim();
                } else if (currentMessage) {
                    currentMessage += "\n\n" + text;
                } else {
                    currentMessage = text;
                }
            }

            if (currentMessage) {
                conversation.push({ role: "assistant", content: currentMessage });
            }
        }
    } else {
        // Parse message elements
        messageElements.forEach((element, index) => {
            const text = element.innerText || element.textContent;
            if (text && text.trim()) {
                // Try to determine if it's user or assistant
                const isUser =
                    element.classList.toString().toLowerCase().includes("user") ||
                    element.closest('[class*="user"]') ||
                    index % 2 === 0; // Assume alternating pattern

                conversation.push({
                    role: isUser ? "user" : "assistant",
                    content: text.trim(),
                });
            }
        });
    }

    console.log("[GeminiSave] Extracted conversation:", conversation);
    return conversation.length > 0 ? { messages: conversation } : null;
}

// Convert to markdown
function convertToMarkdown(data) {
    let markdown = "# Gemini AI Studio Conversation\n\n";
    markdown += `*Generated on ${new Date().toLocaleString()}*\n\n`;
    markdown += `*Source: ${window.location.href}*\n\n---\n\n`;

    if (!data) {
        return markdown + "*No conversation data found*\n";
    }

    // Handle different data structures
    if (Array.isArray(data)) {
        data = { messages: data };
    }

    if (data.messages || data.conversations || data.turns) {
        const messages = data.messages || data.conversations || data.turns;
        messages.forEach((msg, index) => {
            const role = msg.role === "user" ? "## 👤 User" : "## 🤖 Gemini";
            const content =
                msg.content || msg.text || msg.message || JSON.stringify(msg);
            markdown += `${role}\n\n${content}\n\n`;
            if (index < messages.length - 1) {
                markdown += "---\n\n";
            }
        });
    } else {
        // Fallback to raw data
        markdown += "```json\n" + JSON.stringify(data, null, 2) + "\n```\n";
    }

    return markdown;
}

// Handle copy
async function handleCopy() {
    try {
        showNotification("Extracting conversation...", "info");

        const data = await extractConversationData();
        const markdown = convertToMarkdown(data);

        // Copy to clipboard using the extension API
        const result = await chrome.runtime.sendMessage({
            action: "copyToClipboard",
            markdown: markdown, // Send markdown directly
        });

        if (result.success) {
            showNotification("Markdown copied to clipboard!", "success");
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error("[GeminiSave] Copy error:", error);
        showNotification("Failed to copy: " + error.message, "error");
    }
}

// Handle share to Gist
async function handleShare() {
    try {
        showNotification("Creating Gist...", "info");

        const data = await extractConversationData();
        const markdown = convertToMarkdown(data);

        const result = await chrome.runtime.sendMessage({
            action: "shareToGist",
            markdown: markdown, // Send markdown directly
        });

        if (result.success) {
            showNotification("Gist created successfully!", "success");
            window.open(result.url, "_blank");
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error("[GeminiSave] Share error:", error);
        showNotification("Failed to share: " + error.message, "error");
    }
}

// Handle export
async function handleExport() {
    try {
        showNotification("Exporting conversation...", "info");

        const data = await extractConversationData();
        const markdown = convertToMarkdown(data);

        // Create and download file
        const blob = new Blob([markdown], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `gemini-conversation-${new Date().toISOString().slice(0, 10)}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showNotification("Markdown file downloaded!", "success");
    } catch (error) {
        console.error("[GeminiSave] Export error:", error);
        showNotification("Failed to export: " + error.message, "error");
    }
}

// Show notification
function showNotification(message, type = "info") {
    const existing = document.querySelector(".gemini-save-notification");
    if (existing) existing.remove();

    const notification = document.createElement("div");
    notification.className = "gemini-save-notification";
    notification.textContent = message;
    notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 6px;
    background: ${type === "success" ? "#4caf50" : type === "error" ? "#f44336" : "#2196f3"};
    color: white;
    z-index: 10000;
    font-size: 14px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
  `;

    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 4000);
}

// Initialize
setTimeout(injectButtons, 1000);

// Re-inject buttons on page changes
const observer = new MutationObserver(() => {
    if (!document.querySelector(".gemini-save-buttons")) {
        setTimeout(injectButtons, 500);
    }
});

observer.observe(document.body, { childList: true, subtree: true });
