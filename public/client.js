const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let username = '';
let players = {};
let keys = {};

const otterIdle = new Image();
otterIdle.src = 'assets/otter_idle_1.png';

const otterRun = [
    new Image(),
    new Image(),
    new Image()
];
otterRun[0].src = 'assets/otter_run_1.png';
otterRun[1].src = 'assets/otter_run_2.png';
otterRun[2].src = 'assets/otter_run_3.png';

// Animation frame tracker
let runFrame = 0;
let runFrameCounter = 0;


const speed = 3;
let localPlayer = { x: 100, y: 100, direction: 'right', moving: false, chat: '' };

// Resize canvas
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Login
document.getElementById('joinBtn').onclick = () => {
    username = document.getElementById('username').value.trim();
    if (!username) return;
    document.getElementById('login').style.display = 'none';
    console.log(`Joining as ${username}`);
    socket.emit('join', username);
    gameLoop();
};

// Movement
document.addEventListener('keydown', e => keys[e.key] = true);
document.addEventListener('keyup', e => keys[e.key] = false);

// Chat input & send button
const chatInput = document.getElementById('chatInput');
document.getElementById('sendBtn').onclick = sendChat;
chatInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendChat(); });

function sendChat() {
    const msg = chatInput.value.trim();
    if (!msg) return;

    console.log(`Sending chat: ${msg}`);

    // Show locally immediately
    localPlayer.chat = msg;

    // Send to server
    socket.emit('chat', msg);
    chatInput.value = '';

    // Clear after 5 seconds
    setTimeout(() => { localPlayer.chat = ''; }, 5000);
}

// Socket events
socket.on('players', data => {
    // Preserve chat for existing players
    for (let id in data) {
        if (players[id] && players[id].chat) {
            data[id].chat = players[id].chat;
        }
    }

    players = data;

    // Ensure localPlayer stays updated in players list
    if (players[socket.id]) {
        localPlayer = { ...localPlayer, ...players[socket.id] };
        players[socket.id] = localPlayer;
    }
    // console.log('Players updated:', players);
});

// Receive chat from server
socket.on('chat', data => {
    console.log('Received chat:', data);
    if (players[data.id]) {
        players[data.id].chat = data.message;

        // Clear after 5 seconds
        setTimeout(() => {
            if (players[data.id]) players[data.id].chat = '';
        }, 5000);
    }
});

// Game loop
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Update movement
function update() {
    let moving = false;

    if (keys['ArrowUp'] || keys['w']) { localPlayer.y -= speed; moving = true; }
    if (keys['ArrowDown'] || keys['s']) { localPlayer.y += speed; moving = true; }
    if (keys['ArrowLeft'] || keys['a']) { localPlayer.x -= speed; localPlayer.direction = 'left'; moving = true; }
    if (keys['ArrowRight'] || keys['d']) { localPlayer.x += speed; localPlayer.direction = 'right'; moving = true; }

    localPlayer.moving = moving;
    socket.emit('move', localPlayer);
}

// Draw everything
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let id in players) {
        const p = players[id];
        let img;

        // Determine which image to draw
        if (p.moving) {
            // Cycle frames every 8 game loop ticks
            runFrameCounter++;
            if (runFrameCounter >= 8) {
                runFrame = (runFrame + 1) % otterRun.length;
                runFrameCounter = 0;
            }
            img = otterRun[runFrame];
        } else {
            img = otterIdle;
        }

        ctx.save();
        if (p.direction === 'left') {
            ctx.translate(p.x + 132, p.y);
            ctx.scale(-1, 1);
            ctx.drawImage(img, -132, 0, 264, 264);
        } else {
            ctx.drawImage(img, p.x, p.y, 264, 264);
        }
        ctx.restore();

        // Username
        ctx.fillStyle = 'black';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(p.username, p.x + 132, p.y - 10);

        // Chat bubble
        if (p.chat) {
            const padding = 6;
            ctx.font = '14px sans-serif';
            const textWidth = ctx.measureText(p.chat).width + padding * 2;
            const textHeight = 24;
            const bubbleX = p.x + 132 - textWidth / 2;
            const bubbleY = p.y - 60;

            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.fillRect(bubbleX, bubbleY, textWidth, textHeight);
            ctx.strokeStyle = '#4a90e2';
            ctx.lineWidth = 2;
            ctx.strokeRect(bubbleX, bubbleY, textWidth, textHeight);

            ctx.fillStyle = 'black';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(p.chat, bubbleX + textWidth / 2, bubbleY + textHeight / 2);
        }
    }
}