const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const PORT = 3000;

app.use(express.static('public'));

let players = {};
let lanternScores = {}; // Track lantern clicks per player

io.on('connection', (socket) => {
  console.log('New player connected:', socket.id);

  socket.on('join', (username) => {
    console.log(`${username} joined with id ${socket.id}`);
    players[socket.id] = {
      x: Math.random() * 400 + 50,
      y: Math.random() * 300 + 50,
      username: username,
      direction: 'right',
      moving: false,
      chat: ''
    };

    // Initialize lantern score for new player
    if (!lanternScores[username]) {
      lanternScores[username] = 0;
    }

    io.emit('players', players);
    io.emit('lanternLeaderboard', lanternScores); // send leaderboard to everyone
  });

  socket.on('move', (data) => {
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;
      players[socket.id].direction = data.direction;
      players[socket.id].moving = data.moving;
      io.emit('players', players);
    }
  });

  socket.on('chat', (msg) => {
    if (players[socket.id]) {
      console.log(`Chat from ${players[socket.id].username}: ${msg}`);
      players[socket.id].chat = msg;

      // Emit chat only once
      io.emit('chat', { id: socket.id, message: msg, username: players[socket.id].username });

      // Clear chat after 5 seconds on server side as well
      setTimeout(() => {
        if (players[socket.id]) {
          players[socket.id].chat = '';
          io.emit('players', players); // Update clients to remove bubble
        }
      }, 5000);
    }
  });

  // Handle lantern click
  socket.on('lanternClick', (username) => {
    if (!lanternScores[username]) {
      lanternScores[username] = 0;
    }
    
    lanternScores[username]++;
    // console.log(`� ${username} clicked a lantern! Total: ${lanternScores[username]}`);
    
    // Broadcast updated leaderboard to all clients
    io.emit('lanternLeaderboard', lanternScores);
  });

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);

    // Optionally keep candy score for leaderboard persistence
    delete players[socket.id];

    io.emit('players', players);
    // io.emit('leaderboard', candyScores);
  });
});

http.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));