const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const PORT = 3000;

app.use(express.static('public'));

let players = {};

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
    io.emit('players', players);
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

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    delete players[socket.id];
    io.emit('players', players);
  });
});

http.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));