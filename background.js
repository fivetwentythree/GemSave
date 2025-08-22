// Helper function to convert to markdown
function convertToMarkdown(conversationData) {
    try {
        const data = conversationData.data || conversationData;

        // Extract title and messages
        let title = "Gemini Conversation";
        let messages = [];

        // Try different possible data structures
        if (data.conversation) {
            title = data.conversation.title || data.conversation.name || title;
            messages = data.conversation.messages || [];
        } else if (data.messages) {
            messages = data.messages;
            title = data.title || data.name || title;
        } else if (Array.isArray(data)) {
            messages = data;
        } else if (data.turns) {
            messages = data.turns;
        }

        // Build markdown
        let markdown = `# ${title}\n\n`;
        markdown += `*Generated on ${new Date().toLocaleString()}*\n\n---\n\n`;

        messages.forEach((msg, index) => {
            const role =
                msg.role || msg.author || (index % 2 === 0 ? "user" : "assistant");
            const content = msg.content || msg.text || msg.message || "";

            if (content) {
                markdown += `## ${role === "user" ? "👤 User" : "🤖 Gemini"}\n\n`;

                // Handle different content types
                if (typeof content === "string") {
                    markdown += `${content}\n\n`;
                } else if (Array.isArray(content)) {
                    content.forEach((part) => {
                        if (part.text) {
                            markdown += `${part.text}\n\n`;
                        } else if (typeof part === "string") {
                            markdown += `${part}\n\n`;
                        }
                    });
                } else if (content.parts) {
                    content.parts.forEach((part) => {
                        if (part.text) {
                            markdown += `${part.text}\n\n`;
                        }
                    });
                }

                markdown += "---\n\n";
            }
        });

        return markdown;
    } catch (error) {
        console.error("Error converting to markdown:", error);
        throw new Error("Failed to parse conversation data");
    }
}

// Helper function to create GitHub Gist
async function createGist(token, markdown, title = "Gemini Conversation") {
    const filename = `${title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_${Date.now()}.md`;

    const response = await fetch("https://api.github.com/gists", {
        method: "POST",
        headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github.v3+json",
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            description: title,
            public: false,
            files: {
                [filename]: {
                    content: markdown,
                },
            },
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create Gist");
    }

    const gist = await response.json();
    return gist.html_url;
}

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    handleMessage(request, sender).then(sendResponse);
    return true; // Keep message channel open for async response
});

async function handleMessage(request, sender) {
    try {
        const { action, url } = request;

        // Get stored conversation data
        const storage = await chrome.storage.local.get([
            "conversationData",
            "githubToken",
        ]);

        if (!storage.conversationData) {
            return {
                success: false,
                message:
                    "No conversation data found. Please refresh the page and try again.",
            };
        }

        // Convert to markdown
        const markdown = convertToMarkdown(storage.conversationData);

        if (action === "copy") {
            // Return markdown for copying
            await logOperation("success", "Conversation copied to clipboard");
            return {
                success: true,
                markdown: markdown,
                message: "Copied to clipboard!",
            };
        } else if (action === "share") {
            // Create GitHub Gist
            if (!storage.githubToken) {
                return {
                    success: false,
                    message: "Please set your GitHub token in the extension settings",
                };
            }

            const gistUrl = await createGist(
                storage.githubToken,
                markdown,
                storage.conversationData.data?.title || "Gemini Conversation",
            );

            // Open gist in new tab
            chrome.tabs.create({ url: gistUrl });

            await logOperation("success", `Gist created: ${gistUrl}`);
            return {
                success: true,
                message: "Gist created successfully!",
                url: gistUrl,
            };
        }
    } catch (error) {
        await logOperation("error", error.message);
        return {
            success: false,
            message: error.message,
        };
    }
}

async function logOperation(status, message) {
    await chrome.storage.local.set({
        lastOperation: {
            status: status,
            message: message,
            timestamp: new Date().toLocaleString(),
        },
    });
}
