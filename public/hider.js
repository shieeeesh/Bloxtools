// ── Particle canvas (keep whatever you had) ──────────────────────────

const canvas = document.getElementById('particles');
if (canvas) {
    const ctx = canvas.getContext('2d');
    let particles = [];

    const resize = () => {
        canvas.width  = window.innerWidth;
        canvas.height = window.innerHeight;
    };

    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < 55; i++) {
        particles.push({
            x:     Math.random() * canvas.width,
            y:     Math.random() * canvas.height,
            r:     Math.random() * 1.6 + 0.4,
            dx:    (Math.random() - 0.5) * 0.35,
            dy:    (Math.random() - 0.5) * 0.35,
            alpha: Math.random() * 0.5 + 0.1,
        });
    }

    (function loop() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(168,85,247,${p.alpha})`;
            ctx.fill();
            p.x += p.dx;
            p.y += p.dy;
            if (p.x < 0 || p.x > canvas.width)  p.dx *= -1;
            if (p.y < 0 || p.y > canvas.height) p.dy *= -1;
        });
        requestAnimationFrame(loop);
    })();
}


// ── Game File Key visibility toggle ──────────────────────────────────

const gameFileInput  = document.getElementById('gameFile');
const toggleBtn      = document.getElementById('toggleGameFile');

// starts hidden (type=password), button shows the slash
toggleBtn.classList.add('is-hidden');

toggleBtn.addEventListener('click', () => {

    const isPassword = gameFileInput.type === 'password';

    gameFileInput.type = isPassword ? 'text' : 'password';

    gameFileInput.classList.toggle('revealed', isPassword);

    toggleBtn.classList.toggle('is-hidden', !isPassword);

    // pulse animation
    gameFileInput.classList.remove('pulse');
    void gameFileInput.offsetWidth; // reflow trigger
    gameFileInput.classList.add('pulse');
});


// ── Copy button / PIN logic ───────────────────────────────────────────

const copyBtn   = document.getElementById('copyButton');
const pinInput  = document.getElementById('pinInput');
const pinError  = document.getElementById('pinError');
const statusMsg = document.getElementById('statusMessage');

copyBtn.addEventListener('click', () => {

    const pin   = pinInput.value.trim();
    const valid = /^\d{4}$/.test(pin);

    pinError.style.display = valid ? 'none' : 'block';
    if (!valid) return;

    // value is always accessible here regardless of input type
    const gameFileValue = gameFileInput.value;

    copyBtn.classList.add('loading');
    statusMsg.textContent = '';

    setTimeout(() => {
        copyBtn.classList.remove('loading');
        statusMsg.textContent = gameFileValue
            ? 'Processing complete.'
            : 'No game file data provided.';
    }, 1800);
});