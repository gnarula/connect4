var express = require('express');
var async = require('async');
var app = express()
var io = require('socket.io').listen(app.listen(8000));

app.use('/static', express.static(__dirname + '/static'));

app.get('/', function(req, res) {
    share = generateRoom(6);
    res.render('index.jade', {shareURL: req.protocol + '://' + req.get('host') + req.path + share, share: share});
});

app.get('/landingPage', function(req, res) {
    res.render('landing.jade');
});

app.get('/:room([A-Za-z0-9]{6})', function(req, res) {
    share = req.params.room;
    res.render('index.jade', {shareURL: req.protocol + '://' + req.get('host') + '/' + share, share: share});
});


function generateRoom(length) {
    var haystack = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    var room = '';

    for(var i = 0; i < length; i++) {
        room += haystack.charAt(Math.floor(Math.random() * 62));
    }

    return room;
};

// an object to hold all gamestates. Key denotes room id
var games = {};

io.sockets.on('connection', function(socket) {
    socket.on('join', function(data) {
        if(data.room in games) {
            if(typeof games[data.room].player2 != "undefined") {
                socket.emit('leave');
                return;
            }
            socket.join(data.room);
            socket.set('room', data.room);
            socket.set('color', 'bar');
            socket.set('pid', -1);
            games[data.room].player2 = socket
            // Set opponents
            socket.set('opponent', games[data.room].player1);
            games[data.room].player1.set('opponent', games[data.room].player2);

            // Set turn
            socket.set('turn', false);
            socket.get('opponent', function(err, opponent) {
                opponent.set('turn', true);
            });

            socket.emit('assign', {pid: 2});

            games[data.room].player1.emit('notify', {connected: 1, turn: true});
            socket.emit('notify', {connected: 1, turn: false});
        }
        else {
            socket.join(data.room);
            socket.set('room', data.room);
            socket.set('color', 'foo');
            socket.set('pid', 1);
            socket.set('turn', false);
            games[data.room] = {
                player1: socket,
                board: [[0,0,0,0,0,0,0], [0,0,0,0,0,0,0], [0,0,0,0,0,0,0], [0,0,0,0,0,0,0], [0,0,0,0,0,0,0], [0,0,0,0,0,0,0]],
            };
            socket.emit('assign', {pid: 1});
        }
    });
});

console.log('Listening on port 8000');