// offscreen.js - Handles clipboard operations
chrome.runtime.onMessage.addListener(async (message) => {
    if (message.target !== "offscreen") return;

    switch (message.action) {
        case "copy":
            try {
                await navigator.clipboard.writeText(message.data);
                console.log("[GeminiSave] Text copied to clipboard");
            } catch (err) {
                console.error("[GeminiSave] Failed to copy:", err);
            }
            break;
    }
});
