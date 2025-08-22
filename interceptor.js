(function () {
    // Override fetch to intercept responses
    const originalFetch = window.fetch;

    window.fetch = async function (...args) {
        const response = await originalFetch.apply(this, args);
        const url = args[0].toString();

        // Check if this is a conversation data request
        if (
            url.includes("/conversations/") ||
            url.includes("/chats/") ||
            url.includes("/threads/")
        ) {
            // Clone the response to read it
            const clonedResponse = response.clone();

            try {
                const data = await clonedResponse.json();

                // Send data to content script
                window.dispatchEvent(
                    new CustomEvent("gemini-conversation-data", {
                        detail: {
                            url: url,
                            data: data,
                            timestamp: new Date().toISOString(),
                        },
                    }),
                );
            } catch (e) {
                console.error("Failed to parse response:", e);
            }
        }

        return response;
    };

    // Also intercept XMLHttpRequest if needed
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
        this._url = url;
        return originalXHROpen.apply(this, [method, url, ...rest]);
    };

    XMLHttpRequest.prototype.send = function (...args) {
        this.addEventListener("load", function () {
            if (
                this._url &&
                (this._url.includes("/conversations/") ||
                    this._url.includes("/chats/") ||
                    this._url.includes("/threads/"))
            ) {
                try {
                    const data = JSON.parse(this.responseText);
                    window.dispatchEvent(
                        new CustomEvent("gemini-conversation-data", {
                            detail: {
                                url: this._url,
                                data: data,
                                timestamp: new Date().toISOString(),
                            },
                        }),
                    );
                } catch (e) {
                    console.error("Failed to parse XHR response:", e);
                }
            }
        });

        return originalXHRSend.apply(this, args);
    };
})();
