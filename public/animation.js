/* ======================================================
   PARTICLE ANIMATION SYSTEM
====================================================== */

const canvas =
document.getElementById("particles");

const ctx =
canvas.getContext("2d");

let particles = [];

let mouse = {
    x: null,
    y: null
};


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

        ctx.shadowBlur =
            18;

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
   MOUSE EFFECT
====================================================== */

window.addEventListener(
    "mousemove",
    (event) => {

        mouse.x = event.x;
        mouse.y = event.y;
    }
);


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
