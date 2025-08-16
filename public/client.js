const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const barriers = [
    { x: 630, y: 0, width: 520, height: 360 },
    { x: 690, y: 0, width: 580, height: 100 },
    { x: 640, y: 620, width: 500, height: 150 },
    { x: 670, y: 760, width: 490, height: 140 },
    { x: 450, y: 900, width: 750, height: 230 },
    { x: 205, y: 170, width: 150, height: 150 },
];

const otterHitbox = { offsetX: 80, offsetY: 150, width: 100, height: 80 };

let username = '';
let players = {};
let keys = {};

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
    socket.emit('join', username);
    gameLoop();
};

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

socket.on('players', data => {
    for (let id in data) {
        if (players[id] && players[id].chat) data[id].chat = players[id].chat;
        if (!playerAnimations[id]) {
            playerAnimations[id] = { idleFrame: 0, idleCounter: 0, runFrame: 0, runCounter: 0, lastMove: Date.now(), spinPlayed: false, sleepFrame: 0, sleepCounter: 0, state: 'idle' };
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

function gameLoop() { update(); draw(); requestAnimationFrame(gameLoop); }

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

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    for (const barrier of barriers) { ctx.strokeRect(barrier.x, barrier.y, barrier.width, barrier.height); }

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

        ctx.fillStyle = 'white'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(p.username, p.x + 132, p.y + 70);

        if (p.chat) {
            const padding = 6; ctx.font = '14px sans-serif';
            const textWidth = ctx.measureText(p.chat).width + padding * 2; const textHeight = 24;
            const bubbleX = p.x + 132 - textWidth / 2; const bubbleY = p.y + 20;
            ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(bubbleX, bubbleY, textWidth, textHeight);
            ctx.strokeStyle = '#4a90e2'; ctx.lineWidth = 2; ctx.strokeRect(bubbleX, bubbleY, textWidth, textHeight);
            ctx.fillStyle = 'black'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.chat, bubbleX + textWidth / 2, bubbleY + textHeight / 2);
        }
    }
}