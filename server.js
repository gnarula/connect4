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

// Helper function
function getPair(row, column, step) {
    l = [];
    for(var i = 0; i < 4; i++) {
        l.push([row, column]);
        row += step[0];
        column += step[1];
    }
    return l;
}

// a list to hold win cases
var check = [];

check.push(function check_horizontal(room, row, startColumn, callback) {
    for(var i = 1; i < 5; i++) {
        var count = 0;
        var column = startColumn + 1 - i;
        var columnEnd = startColumn + 4 - i;
        if(columnEnd > 6 || column < 0) {
            continue;
        }
        var pairs = getPair(row, column, [0,1]);
        for(var j = column; j < columnEnd + 1; j++) {
            count += games[room]['board'][row][j];
        }
        if(count == 4)
            callback(1, pairs);
        else if(count == -4)
            callback(2, pairs);
    }
});

check.push(function check_vertical(room, startRow, column, callback) {
    for(var i = 1; i < 5; i++) {
        var count = 0;
        var row = startRow + 1 - i;
        var rowEnd = startRow + 4 - i;
        if(rowEnd > 5 || row < 0) {
            continue;
        }
        var pairs = getPair(row, column, [1,0]);
        for(var j = row; j < rowEnd + 1; j++) {
            count += games[room]['board'][j][column];
        }
        if(count == 4)
            callback(1, pairs);
        else if(count == -4)
            callback(2, pairs);
    }
});

check.push(function check_leftDiagonal(room, startRow, startColumn, callback) {
    for(var i = 1; i < 5; i++) {
        var count = 0;
        var row = startRow + 1 - i;
        var rowEnd = startRow + 4 - i;
        var column = startColumn + 1 - i;
        var columnEnd = startColumn + 4 - i;
        if(column < 0 || columnEnd > 6 || rowEnd > 5 || row < 0) {
            continue;
        }
        var pairs = getPair(row, column, [1,1]);
        for(var j = 0; j < pairs.length; j++) {
            count += games[room]['board'][pairs[j][0]][pairs[j][1]];
        }
        if(count == 4)
            callback(1, pairs);
        else if(count == -4)
            callback(2, pairs);
    }
});


check.push(function check_rightDiagonal(room, startRow, startColumn, callback) {
    for(var i = 1; i < 5; i++) {
        var count = 0;
        var row = startRow + 1 - i;
        var rowEnd = startRow + 4 - i;
        var column = startColumn -1 + i;
        var columnEnd = startColumn - 4 + i;
        if(column < 0 || columnEnd > 6 || rowEnd > 5 || row < 0) {
            continue;
        }
        var pairs = getPair(row, column, [1,-1]);
        for(var j = 0; j < pairs.length; j++) {
            count += games[room]['board'][pairs[j][0]][pairs[j][1]];
        }
        if(count == 4)
            callback(1, pairs);
        else if(count == -4)
            callback(2, pairs);
        else {
            check_draw(room, function() {
                games[room].board = [[0,0,0,0,0,0,0], [0,0,0,0,0,0,0], [0,0,0,0,0,0,0], [0,0,0,0,0,0,0], [0,0,0,0,0,0,0], [0,0,0,0,0,0,0]];
                io.sockets.in(room).emit('reset', {'text': 'Game Drawn', 'inc': [0,0]});
            });
        }
    }
});

// Function to check for draw
function check_draw(room, callback) {
    for(var index in games[room]['board'][0]) {
        if(games[room]['board'][0][index] == 0)
            return;
    }
    callback();
}

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
            socket.set('color', '#FB6B5B');
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
            socket.set('color', '#FFC333');
            socket.set('pid', 1);
            socket.set('turn', false);
            games[data.room] = {
                player1: socket,
                board: [[0,0,0,0,0,0,0], [0,0,0,0,0,0,0], [0,0,0,0,0,0,0], [0,0,0,0,0,0,0], [0,0,0,0,0,0,0], [0,0,0,0,0,0,0]],
            };
            socket.emit('assign', {pid: 1});
        }
    });

    socket.on('click', function(data) {
        async.parallel([
            socket.get.bind(this, 'turn'),
            socket.get.bind(this, 'opponent'),
            socket.get.bind(this, 'room'),
            socket.get.bind(this, 'pid')
        ], function(err, results) {
            if(results[0]) {
                socket.set('turn', false);
                results[1].set('turn', true);

                var i = 5;
                while(i >= 0) {
                    if(games[results[2]].board[i][data.column] == 0) {
                        break;
                    }
                    i--;
                }
                if(i >= 0 && data.column >= 0) {
                    games[results[2]].board[i][data.column] = results[3];
                    socket.get('color', function(err, color) {
                        socket.emit('drop', {row: i, column: data.column, color: color});
                        results[1].emit('drop', {row: i, column: data.column, color: color});
                    });
                    var win = false;
                    check.forEach(function(method) {
                        method(results[2], i, data.column, function(player, pairs) {
                            if(player == 1) {
                                games[results[2]].player1.emit('reset', {text: 'You Won!', 'inc': [1,0], highlight: pairs });
                                games[results[2]].player2.emit('reset', {text: 'You Lost!', 'inc': [1,0], highlight: pairs });
                            }
                            else {
                                games[results[2]].player1.emit('reset', {text: 'You Lost!', 'inc': [0,1], highlight: pairs });
                                games[results[2]].player2.emit('reset', {text: 'You Won!', 'inc': [0,1], highlight: pairs });
                            }
                            games[results[2]].board = [[0,0,0,0,0,0,0], [0,0,0,0,0,0,0], [0,0,0,0,0,0,0], [0,0,0,0,0,0,0], [0,0,0,0,0,0,0], [0,0,0,0,0,0,0]];
                        });
                    });
                }
            }
        });
    });

    socket.on('continue', function() {
        socket.get('turn', function(err, turn) {
            socket.emit('notify', {connected: 1, turn: turn});
        });
    });

    socket.on('disconnect', function() {
        console.log('Disconnected');
        socket.get('room', function(err, room) {
            io.sockets.in(room).emit('leave');
            if(room in games) {
                delete games.room;
            }
        });
    });
});

console.log('Listening on port 8000');
