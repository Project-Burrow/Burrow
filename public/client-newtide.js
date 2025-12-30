const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const barriers = [
    { x: 650, y: 0, width: 520, height: 360 }, // Barrier 1, above bridge
    { x: 690, y: 0, width: 580, height: 100 }, // Barrier 2, top right of barrier 1
    { x: 640, y: 620, width: 500, height: 150 }, // Barrier 3, below bridge
    { x: 670, y: 760, width: 490, height: 140 }, // Barrier 4, below barrier 3
    { x: 470, y: 910, width: 780, height: 180 }, // Barrier 5, below 4 and has tree
    { x: 230, y: 170, width: 150, height: 150 }, // Bush barrier 

    // Christmas
    { x: 450, y: 620, width: 120, height: 150 }, // Snowman
    { x: 1170, y: 690, width: 110, height: 130 }, // Present right side
    // Christmas Tree
    { x: 1685, y: 530, width: 160, height: 180 }, // Bottompart
    { x: 1725, y: 360, width: 80, height: 140 }, // Top part

    // Billboard/Countdown sign
    { x: 1260, y: 160, width: 450, height: 230, isCountdown: true }, // Billboard area with countdown

    // Border around the canvas to prevent people from getting off screen
    { x: -100, y: -100, width: 1920 + 200, height: 100 }, // Top
    { x: -100, y: 1080, width: 1920 + 200, height: 100 }, // Bottom
    { x: -100, y: 0, width: 100, height: 1080 }, // Left
    { x: 1920, y: 0, width: 100, height: 1080 }, // Right

];

const otterHitbox = { offsetX: 80, offsetY: 150, width: 100, height: 80 };

let username = '';
let players = {};
let keys = {};
let lanternScores = {};
let lanterns = [];
const LANTERN_COUNT = 4; // Reduced number of lanterns for better visibility

// Load images
const otterIdle = [new Image(), new Image(), new Image(), new Image()];
otterIdle[0].src = 'assets/otter_idle_1.png';
otterIdle[1].src = 'assets/otter_idle_2.png';
otterIdle[2].src = 'assets/otter_idle_3.png';
otterIdle[3].src = 'assets/otter_idle_4.png';

const otterRun = [new Image(), new Image(), new Image()];
otterRun[0].src = 'assets/otter_run_1.png';
otterRun[1].src = 'assets/otter_run_2.png';
otterRun[2].src = 'assets/otter_run_3.png';

const otterSpin = [new Image(), new Image(), new Image()];
otterSpin[0].src = 'assets/otter_spin_1.png';
otterSpin[1].src = 'assets/otter_spin_2.png';
otterSpin[2].src = 'assets/otter_spin_3.png';

const otterSleep = [new Image(), new Image(), new Image(), new Image(), new Image(), new Image()];
otterSleep[0].src = 'assets/otter_sleep_1.png';
otterSleep[1].src = 'assets/otter_sleep_2.png';
otterSleep[2].src = 'assets/otter_sleep_3.png';
otterSleep[3].src = 'assets/otter_sleep_4.png';
otterSleep[4].src = 'assets/otter_sleep_5.png';
otterSleep[5].src = 'assets/otter_sleep_6.png';

const emoteImg = new Image();
emoteImg.src = 'assets/emote.webp';

// Christmas
const emoteImg2 = new Image();
emoteImg2.src = 'assets/emote3.png';

// 🎵 Background Music
const bgMusic = new Audio('/assets/newtide.mp3');
bgMusic.volume = 0.015; // 20% volume
bgMusic.loop = true;

// Flag to check if music is already playing
let musicStarted = false;

const muteBtn = document.getElementById('muteBtn');
const unmuteBtn = document.getElementById('unmuteBtn');

// Mute music
muteBtn.addEventListener('click', () => {
    bgMusic.muted = true;
    muteBtn.style.display = 'none';
    unmuteBtn.style.display = 'inline-block';
});

// Unmute music
unmuteBtn.addEventListener('click', () => {
    bgMusic.muted = false;
    unmuteBtn.style.display = 'none';
    muteBtn.style.display = 'inline-block';
});

const speed = 3;
let localPlayer = { x: 100, y: 340, direction: 'right', moving: false, chat: '' };
const playerAnimations = {};
const idleTimeout = 10000;

function resizeCanvas() { canvas.width = 1920; canvas.height = 1080; }
resizeCanvas();

document.getElementById('joinBtn').onclick = () => {
    username = document.getElementById('username').value.trim();
    if (!username) return;

    document.getElementById('login').style.display = 'none';

    // Wait until at least the first idle frame of otter is loaded
    const firstOtterImage = otterIdle[0];
    if (firstOtterImage.complete) {
        startGameAndMusic();
    } else {
        firstOtterImage.onload = startGameAndMusic;
    }
};

function startGameAndMusic() {
    // Play background music if not already started
    if (!musicStarted) {
        bgMusic.play().catch(() => {
            console.warn('Music autoplay prevented by browser, will require user interaction.');
        });
        musicStarted = true;
    }

    socket.emit('join', username);
    gameLoop();
}

document.addEventListener('keydown', e => keys[e.key] = true);
document.addEventListener('keyup', e => keys[e.key] = false);

const chatInput = document.getElementById('chatInput');
document.getElementById('sendBtn').onclick = sendChat;
chatInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendChat(); });

function sendChat() {
    const msg = chatInput.value.trim();
    if (!msg) return;
    localPlayer.chat = msg;
    socket.emit('chat', msg);
    chatInput.value = '';
    setTimeout(() => { localPlayer.chat = ''; }, 5000);
}

// Inside your socket 'players' update, reset spinPlayed and state for localPlayer movement
socket.on('players', data => {
    for (let id in data) {
        if (!playerAnimations[id]) {
            playerAnimations[id] = {
                idleFrame: 0, idleCounter: 0, runFrame: 0, runCounter: 0,
                lastMove: Date.now(), spinPlayed: false, sleepFrame: 0, sleepCounter: 0, state: 'idle'
            };
        }

        // Update animation based on movement
        const anim = playerAnimations[id];

        if (data[id].moving) {
            anim.state = 'running';
            anim.spinPlayed = false;
            anim.sleepFrame = 0;
            anim.sleepCounter = 0;
            anim.lastMove = Date.now();  // <<< Reset lastMove whenever this player is moving
        }
    }

    players = data;
    if (players[socket.id]) {
        localPlayer = { ...localPlayer, ...players[socket.id] };
        players[socket.id] = localPlayer;
    }
});

socket.on('chat', data => {
    if (players[data.id]) {
        players[data.id].chat = data.message;
        setTimeout(() => { if (players[data.id]) players[data.id].chat = ''; }, 5000);
    }
});

// --- Snow Setup ---
// ---
// --- Snow Setup ---
const snowflakes = [];
const snowflakeCount = 150;

for (let i = 0; i < snowflakeCount; i++) {
    snowflakes.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 3 + 2,
        speed: Math.random() * 1 + 0.5,
        wind: Math.random() * 1 - 0.5,
        opacity: Math.random() * 0.5 + 0.5, // makes some flakes brighter
        hue: 200 + Math.random() * 40,      // subtle bluish tint
        flicker: Math.random() * Math.PI * 2
    });
}

function updateSnow() {
    for (let flake of snowflakes) {
        flake.y += flake.speed;
        flake.x += flake.wind;

        // Gentle flicker animation for glow
        flake.flicker += 0.03;
        flake.opacity = 0.6 + 0.4 * Math.sin(flake.flicker);

        if (flake.y > canvas.height) {
            flake.y = -flake.radius;
            flake.x = Math.random() * canvas.width;
        }
        if (flake.x > canvas.width) flake.x = 0;
        if (flake.x < 0) flake.x = canvas.width;
    }
}

function drawSnow() {
    for (let flake of snowflakes) {
        const gradient = ctx.createRadialGradient(flake.x, flake.y, 0, flake.x, flake.y, flake.radius * 2);
        gradient.addColorStop(0, `hsla(${flake.hue}, 100%, 100%, ${flake.opacity})`);
        gradient.addColorStop(1, `hsla(${flake.hue}, 100%, 70%, 0)`);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(flake.x, flake.y, flake.radius * 1.5, 0, Math.PI * 2);
        ctx.fill();
    }
}

// --- Integrate into your gameLoop ---
function gameLoop() {
    update();
    draw();
    updateSnow();
    drawSnow(); // Draw on top of everything
    requestAnimationFrame(gameLoop);
}

// function gameLoop() { update(); draw(); requestAnimationFrame(gameLoop); }

function update() {
    let nextX = localPlayer.x;
    let nextY = localPlayer.y;
    let moving = false;

    if (keys['ArrowUp'] || keys['w']) { nextY -= speed; moving = true; }
    if (keys['ArrowDown'] || keys['s']) { nextY += speed; moving = true; }
    if (keys['ArrowLeft'] || keys['a']) { nextX -= speed; localPlayer.direction = 'left'; moving = true; }
    if (keys['ArrowRight'] || keys['d']) { nextX += speed; localPlayer.direction = 'right'; moving = true; }

    const otterBox = { x: nextX + otterHitbox.offsetX, y: nextY + otterHitbox.offsetY, width: otterHitbox.width, height: otterHitbox.height };

    let collides = false;
    for (const barrier of barriers) {
        if (otterBox.x < barrier.x + barrier.width && otterBox.x + otterBox.width > barrier.x && otterBox.y < barrier.y + barrier.height && otterBox.y + otterBox.height > barrier.y) { collides = true; break; }
    }

    if (!collides) { localPlayer.x = nextX; localPlayer.y = nextY; }

    localPlayer.moving = moving;

    // Reset spin animation if the player starts moving again
    if (moving) {
        const anim = playerAnimations[socket.id];
        if (anim) anim.spinPlayed = false;
    }

    socket.emit('move', localPlayer);
}

function getTimeRemaining() {
    const now = new Date();
    const newYear = new Date(2026, 0, 1, 0, 0, 0); // January is 0 in JavaScript
    // Dec 30st 17:00 local
    // const newYear = new Date(2025, 11, 30, 16, 56, 0); // December is 11 in JavaScript
    const diff = newYear - now;
    
    // If countdown is over
    if (diff <= 0) {
        return { isOver: true };
    }
    
    // Calculate time remaining
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    return {
        isOver: false,
        days,
        hours,
        minutes,
        seconds,
        total: diff
    };
}

function drawCountdown(x, y, width, height) {
    const time = getTimeRemaining();
    
    // No background or border - will be transparent
    ctx.textAlign = 'center';
    
    if (time.isOver) {
        // Draw celebration message
        ctx.fillStyle = 'rgba(255, 215, 0, 0.9)'; // Gold color for celebration
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 3;
        ctx.shadowBlur = 5;
        
        // Main message
        ctx.font = 'bold 36px Arial';
        ctx.fillText('Happy New Year!', x + width/2, y + 80);
        
        // Sub message
        ctx.font = 'bold 28px Arial';
        ctx.fillText('Have a wonderful 2026, otters!', x + width/2, y + 130);
        
        // Add some celebratory emojis
        ctx.font = '40px Arial';
        ctx.fillText('🎉 🦦 🎊', x + width/2, y + 190);
        
    } else {
        // Draw countdown as normal
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = 'bold 28px Arial';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        ctx.shadowBlur = 3;
        
        ctx.fillText('New Tide Countdown', x + width/2, y + 50);
        
        // Draw time remaining
        ctx.font = '24px Arial';
        ctx.fillText('Time until 2026:', x + width/2, y + 100);
        
        // Draw countdown numbers with larger, bolder font
        const timeStr = `${time.days}d ${time.hours}h ${time.minutes}m ${time.seconds}s`;
        ctx.font = 'bold 40px Arial';
        ctx.fillText(timeStr, x + width/2, y + 160);
    }
    
    // Reset shadow
    ctx.shadowColor = 'transparent';
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    for (const barrier of barriers) { 
        // Show barriers by uncommenting
        // ctx.strokeRect(barrier.x, barrier.y, barrier.width, barrier.height);
        
        // Draw countdown on the billboard
        if (barrier.isCountdown) {
            drawCountdown(barrier.x, barrier.y, barrier.width, barrier.height);
        }
    }

    for (let id in players) {
        const p = players[id];
        const anim = playerAnimations[id];
        const now = Date.now();

        if (p.moving) { anim.lastMove = now; anim.state = 'running'; anim.runCounter++; if (anim.runCounter >= 8) { anim.runFrame = (anim.runFrame + 1) % otterRun.length; anim.runCounter = 0; } }
        else {
            if (now - anim.lastMove > idleTimeout) {
                if (!anim.spinPlayed) {
                    anim.state = 'spinning';
                    anim.idleCounter++; if (anim.idleCounter >= 12) { anim.idleFrame++; anim.idleCounter = 0; }
                    if (anim.idleFrame >= otterSpin.length) { anim.spinPlayed = true; anim.state = 'sleeping'; anim.sleepFrame = 0; anim.sleepCounter = 0; }
                } else {
                    anim.state = 'sleeping';
                    anim.sleepCounter++; if (anim.sleepCounter >= 12) { anim.sleepFrame = (anim.sleepFrame + 1) % otterSleep.length; anim.sleepCounter = 0; }
                }
            } else { anim.state = 'idle'; anim.idleCounter++; if (anim.idleCounter >= 12) { anim.idleFrame = (anim.idleFrame + 1) % otterIdle.length; anim.idleCounter = 0; } }
        }

        let img;
        if (anim.state === 'running') img = otterRun[anim.runFrame];
        else if (anim.state === 'spinning') img = otterSpin[Math.min(anim.idleFrame, otterSpin.length - 1)];
        else if (anim.state === 'sleeping') img = otterSleep[anim.sleepFrame];
        else img = otterIdle[anim.idleFrame];

        ctx.save();
        if (p.direction === 'left') { ctx.translate(p.x + 132, p.y); ctx.scale(-1, 1); ctx.drawImage(img, -132, 0, 264, 264); }
        else { ctx.drawImage(img, p.x, p.y, 264, 264); }
        ctx.restore();

        ctx.fillStyle = 'black'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(p.username, p.x + 132, p.y + 250);

        if (p.chat) {
            const paddingX = 16;  // horizontal padding
            const paddingY = 10;  // vertical padding
            ctx.font = '16px sans-serif';

            // Determine width/height for bubble
            let textWidth, textHeight;
            const isEmote = p.chat === '__EMOTE__' || p.chat === '__EMOTE2__';
            if (isEmote) {
                const emoteSize = p.chat === '__EMOTE2__' ? 120 : 80;
                textWidth = emoteSize + paddingX * 2;   // emote width
                textHeight = emoteSize + paddingY * 2;  // emote height
            } else {
                textWidth = ctx.measureText(p.chat).width + paddingX * 2;
                textHeight = 24 + paddingY * 2;
            }

            const bubbleX = p.x + 132 - textWidth / 2;
            let bubbleY;
            if (p.chat === '__EMOTE2__') {
                bubbleY = p.y - 60; // higher for the larger emote
            } else if (isEmote) {
                bubbleY = p.y - 40; // current position for the smaller emote
            } else {
                bubbleY = p.y + 20; // position for regular text
            }

            // Draw rounded rectangle
            const radius = 18;
            ctx.fillStyle = 'rgba(255,255,255,0.95)';
            // ctx.strokeStyle = '#4a90e2';
            ctx.lineWidth = 2;

            ctx.beginPath();
            ctx.moveTo(bubbleX + radius, bubbleY);
            ctx.lineTo(bubbleX + textWidth - radius, bubbleY);
            ctx.quadraticCurveTo(bubbleX + textWidth, bubbleY, bubbleX + textWidth, bubbleY + radius);
            ctx.lineTo(bubbleX + textWidth, bubbleY + textHeight - radius);
            ctx.quadraticCurveTo(bubbleX + textWidth, bubbleY + textHeight, bubbleX + textWidth - radius, bubbleY + textHeight);
            ctx.lineTo(bubbleX + radius, bubbleY + textHeight);
            ctx.quadraticCurveTo(bubbleX, bubbleY + textHeight, bubbleX, bubbleY + textHeight - radius);
            ctx.lineTo(bubbleX, bubbleY + radius);
            ctx.quadraticCurveTo(bubbleX, bubbleY, bubbleX + radius, bubbleY);
            ctx.fill();
            ctx.stroke();

            // Draw bubble tail
            const tailWidth = 12;
            const tailHeight = 8;
            const tailX = bubbleX + textWidth / 2 - tailWidth / 2;
            const tailY = bubbleY + textHeight;

            ctx.beginPath();
            ctx.moveTo(tailX, tailY);
            ctx.lineTo(tailX + tailWidth, tailY);
            ctx.lineTo(tailX + tailWidth / 2, tailY + tailHeight);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Draw text or emote
            if (isEmote) {
                let imgWidth, imgHeight;
                const imgToDraw = p.chat === '__EMOTE2__' ? emoteImg2 : emoteImg;
                
                // Set different sizes based on which emote is being drawn
                if (p.chat === '__EMOTE2__') {
                    imgWidth = 120;  // Larger size for emote2
                    imgHeight = 120;
                } else {
                    imgWidth = 80;   // Default size for regular emote
                    imgHeight = 80;
                }

                if (imgToDraw.complete && imgToDraw.naturalWidth > 0) {
                    ctx.drawImage(
                        imgToDraw,
                        bubbleX + (textWidth - imgWidth) / 2,
                        bubbleY + (textHeight - imgHeight) / 2,
                        imgWidth,
                        imgHeight
                    );
                }
            }
            else {
                ctx.fillStyle = 'black';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(p.chat, bubbleX + textWidth / 2, bubbleY + textHeight / 2);
            }
        }

    }
}

// Create a single lantern
function createLantern(count = 1) {
    const container = document.getElementById('lanterns-container') || (() => {
        const c = document.createElement('div');
        c.id = 'lanterns-container';
        document.body.appendChild(c);
        return c;
    })();
    
    for (let i = 0; i < count; i++) {
        const lantern = document.createElement('div');
        lantern.className = 'lantern';
        
        // Random position with margin from edges
        const margin = 100;
        const x = margin + Math.random() * (window.innerWidth - 2 * margin);
        const y = margin + Math.random() * (window.innerHeight - 2 * margin);
        
        // Random size variation (80% to 120% of original size)
        const sizeScale = 0.8 + Math.random() * 0.4;
        const width = 60 * sizeScale;
        const height = 80 * sizeScale;
        
        // Random color variation
        const hue = 30 + Math.random() * 20; // Yellow-orange range
        const saturation = 80 + Math.random() * 20; // 80-100%
        const lightness = 40 + Math.random() * 20; // 40-60%
        
        // Apply styles
        Object.assign(lantern.style, {
            left: `${x}px`,
            top: `${y}px`,
            width: `${width}px`,
            height: `${height}px`,
            background: `linear-gradient(145deg, hsl(${hue}, ${saturation}%, ${lightness}%), hsl(${hue - 10}, ${saturation}%, ${lightness - 10}%))`,
            boxShadow: `0 0 ${40 * sizeScale}px ${10 * sizeScale}px rgba(255, 200, 0, 0.3),
                        0 0 ${20 * sizeScale}px ${5 * sizeScale}px rgba(255, 100, 0, 0.2)`
        });
        
        // Add glow effect
        const glow = document.createElement('div');
        glow.className = 'lantern-glow';
        
        // Create particles container
        const particles = document.createElement('div');
        particles.className = 'lantern-particles';
        
        // Add decorative elements
        for (let j = 0; j < 3; j++) {
            const deco = document.createElement('div');
            deco.className = 'lantern-deco';
            deco.style.width = `${Math.random() * 10 + 5}px`;
            deco.style.height = `${Math.random() * 3 + 2}px`;
            deco.style.background = `hsl(${hue - 10}, ${saturation}%, ${lightness - 20}%)`;
            deco.style.top = `${30 + j * 15}%`;
            lantern.appendChild(deco);
        }
        
        lantern.appendChild(glow);
        lantern.appendChild(particles);
        
        // Add subtle floating animation
        lantern.style.animation = `float ${6 + Math.random() * 4}s ease-in-out infinite`;
        
        // Add click handler
        lantern.addEventListener('click', (e) => {
            e.stopPropagation();
            if (username) {
                socket.emit('lanternClick', username);
                // Remove the lantern with an effect
                lanternClickEffect(lantern, () => {
                    // After animation completes, remove and respawn
                    const index = lanterns.indexOf(lantern);
                    if (index > -1) {
                        lanterns.splice(index, 1);
                        lantern.remove();
                        // Wait 1 second before spawning a new lantern
                        setTimeout(() => {
                            createLantern(1);
                        }, 1000);
                    }
                });
            }
        });
        
        container.appendChild(lantern);
        lanterns.push(lantern);
    }
    return lanterns.slice(-count);
}

// Create initial lanterns
function createLanterns() {
    // Clear existing lanterns if any
    const existing = document.getElementById('lanterns-container');
    if (existing) existing.remove();
    lanterns = [];
    
    // Create new lanterns
    return createLantern(LANTERN_COUNT);
}

// Add floating animation
const style = document.createElement('style');
style.textContent = `
    @keyframes float {
        0%, 100% { transform: translateY(0) rotate(0deg); }
        50% { transform: translateY(-10px) rotate(1deg); }
    }
    
    .lantern-deco {
        position: absolute;
        background: #8B4513;
        border-radius: 2px;
        left: 50%;
        transform: translateX(-50%);
    }
`;
document.head.appendChild(style);

// Handle lantern click effect
function lanternClickEffect(lantern, onComplete) {
    // Brighten and fade out
    lantern.style.opacity = '0.9';
    lantern.style.transform = 'scale(1.2)';
    
    // Create spark particles
    createSparks(lantern);
    
    // Fade out and scale down with longer duration
    lantern.style.transition = 'all 0.8s ease-out, opacity 1s ease-in-out';
    lantern.style.opacity = '0';
    lantern.style.transform = 'scale(0.3)';
    
    // Call onComplete when animation is done (slightly longer than the transition)
    setTimeout(() => {
        if (onComplete) onComplete();
    }, 1000);
}

// Create spark particles
function createSparks(lantern) {
    const particles = lantern.querySelector('.lantern-particles');
    particles.innerHTML = ''; // Clear previous particles
    
    for (let i = 0; i < 8; i++) {
        const spark = document.createElement('div');
        spark.className = 'spark';
        spark.style.setProperty('--angle', `${Math.random() * 360}deg`);
        spark.style.setProperty('--delay', `${Math.random() * 0.5}s`);
        particles.appendChild(spark);
    }
}

// Update leaderboard display
function updateLeaderboard(scores) {
    const leaderboard = document.getElementById('leaderboard');
    if (!leaderboard) return;
    
    // Sort scores
    const sortedScores = Object.entries(scores)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10); // Show top 10
    
    leaderboard.innerHTML = `
        <h3>🏮 Lantern Leaderboard</h3>
        ${sortedScores.map(([name, score]) => 
            `<div class="leaderboard-entry">
                <span class="leaderboard-name">${name}</span>
                <span class="leaderboard-score">${score} 🏮</span>
            </div>`
        ).join('')}
    `;
}

// Listen for leaderboard updates
socket.on('lanternLeaderboard', (scores) => {
    lanternScores = scores;
    updateLeaderboard(scores);
});

// Initialize game
function initGame() {
    createLanterns();
    
    // Create leaderboard element
    const leaderboard = document.createElement('div');
    leaderboard.id = 'leaderboard';
    document.body.appendChild(leaderboard);
    
    // Request initial leaderboard data
    if (username) {
        socket.emit('join', username);
    }
}

// Start the game when the page loads
window.addEventListener('load', initGame);

//     // Open inventory when button is clicked
//     inventoryButton.addEventListener("click", () => {
//         inventoryPanel.classList.add("show");
//     });

//     // Close inventory when close button is clicked
//     closeInventoryBtn.addEventListener("click", () => {
//         inventoryPanel.classList.remove("show");
//     });

//     // Optional: Close inventory when pressing "Escape"
//     document.addEventListener("keydown", (e) => {
//         if (e.key === "Escape") {
//             inventoryPanel.classList.remove("show");
//         }
//     });
// });

// Emote button functionality
const emoteBtn = document.getElementById('emoteBtn');
emoteBtn.addEventListener('click', () => {
    // Send a special tag instead of a URL
    const emoteTag = '__EMOTE__';
    localPlayer.chat = emoteTag;
    socket.emit('chat', emoteTag);

    setTimeout(() => { localPlayer.chat = ''; }, 5000);
});

// Christmas
const emoteBtn2 = document.getElementById('emoteBtn2');
emoteBtn2.addEventListener('click', () => {
    // Send a special tag instead of a URL
    const emoteTag2 = '__EMOTE2__';
    localPlayer.chat = emoteTag2;
    socket.emit('chat', emoteTag2);

    setTimeout(() => { localPlayer.chat = ''; }, 5000);
});