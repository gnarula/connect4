var 
express = require('express'),
async = require('async'),
app = express(),
io = require('socket.io')({ 'match origin protocol': true }).listen( app.listen(process.env.PORT) );
app.use('/static', express.static(__dirname + '/static'));


// ROOMS

function generateRoom(length) {
    var haystack = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    var room = '';
 
    for(var i = 0; i < length; i++) {
        room += haystack.charAt(Math.floor(Math.random() * 62));
    }
 
    return room;
};




// ROUTES 

app.get('/', function(req, res) {
    share = generateRoom(6);
    res.render('index.jade', 
      // template data
      {
          shareURL: req.protocol + '://' + req.get('host') + req.path + share, share: share
      }
    );
});
 
app.get('/:room([A-Za-z0-9]{6})', function(req, res) {
    share = req.params.room;
    res.render('index.jade', {shareURL: req.protocol + '://' + req.get('host') + '/' + share, share: share});
});

 
app.get('/landingPage', function(req, res) {
    res.render('landing.jade');
});


// GAMES

var games = {};

 
io.sockets.on('connection', function(socket) {
    
    //JOIN ROOM
    socket.on('join', function(data) {
        if(data.room in games) {
            if(typeof games[data.room].player2 != "undefined") {
                socket.emit('leave');
                return;
            }
            
            socket.join(data.room);
            socket.room = data.room;
            socket.color = '#FB6B5B';
            socket.pid = -1;
            games[data.room].player2 = socket;
            
            // Set opponents
            socket['opponent'] = games[data.room].player1;
            games[data.room].player1['opponent'] = games[data.room].player2;
 
            // Set turn
            socket.turn = false;
            socket.opponent.turn = true;
            socket.emit('assign', { pid: 2 });
            
            // Notify
            games[data.room].player1.emit('notify', {
              connected: 1, turn: true
            });
            
            socket.emit('notify', {
              connected: 1, turn: false
            });
 
        } else {
          
            socket.join(data.room);
            socket['room'] = data.room;
            socket['color'] = '#FFC333';
            socket['pid'] = 1;
            socket['turn'] = [ false ];
            games[data.room] = {
                player1: socket,
                board: [
                  [0,0,0,0,0,0,0], 
                  [0,0,0,0,0,0,0], 
                  [0,0,0,0,0,0,0], 
                  [0,0,0,0,0,0,0], 
                  [0,0,0,0,0,0,0], 
                  [0,0,0,0,0,0,0]
                ]
            };
            socket.emit('assign', {pid: 1});
        }
    });
    
    
    socket.on('click', function(data) {
        if(typeof(socket.opponent)=='undefined') {
            console.log('no opponent?');
            return socket.emit('notify', { message: 'You need an opponent!, copy & send the share link above!' });
        }

        if(socket.turn) {
            socket['turn'] = false;
            socket.opponent.turn =  true;
 
            var i = 5;
            while(i >= 0) {
                if(games[socket.room].board[i][data.column] == 0) {
                    break;
                }
                i--;
            }
            if(i >= 0 && data.column >= 0) {
                games[socket.room].board[i][data.column] = socket.pid;
                socket.emit('drop', {row: i, column: data.column, color: socket.color});
                socket.opponent.emit('drop', {row: i, column: data.column, color: socket.color});

                var win = false;
                check.forEach(function(method) {
                    method(socket.room, i, data.column, function(player, pairs) {
                        win = true;
                        if(player == 1) {
                            games[socket.room].player1.emit('reset', {
                                text: 'You Won!', 
                                'inc': [1,0], 
                                highlight: pairs 
                            });
                            games[socket.room].player2.emit('reset', {
                                text: 'You Lost!', 
                                'inc': [1,0], highlight: pairs 
                            });
                        } else {
                            games[socket.room].player1.emit('reset', {text: 'You Lost!', 'inc': [0,1], highlight: pairs });
                            games[socket.room].player2.emit('reset', {text: 'You Won!', 'inc': [0,1], highlight: pairs });
                        }
                        games[socket.room].board = [[0,0,0,0,0,0,0], [0,0,0,0,0,0,0], [0,0,0,0,0,0,0], [0,0,0,0,0,0,0], [0,0,0,0,0,0,0], [0,0,0,0,0,0,0]];
                    });
                });
                if(win)  return;
                
                check_draw(socket.room, function() {
                    games[socket.room].board = [[0,0,0,0,0,0,0], [0,0,0,0,0,0,0], [0,0,0,0,0,0,0], [0,0,0,0,0,0,0], [0,0,0,0,0,0,0], [0,0,0,0,0,0,0]];
                    io.sockets.in(socket.room).emit('reset', {'text': 'Game Drawn', 'inc': [0,0]});
                });
            }
        } else {
            socket.emit('notify', { wrongTurn: 1, turn: socket.turn});
        }
      
    }); // end click handler
    
    
    socket.on('continue', function() {
        socket.emit('notify', {connected: 1, turn: socket.turn });
    });
    
    
    socket.on('disconnect', function() {
        if(!socket.room){
            io.sockets.in(room).emit('leave');
            if(room in games) {
                delete games.room;
            }
        }
    });
    
    
    // LOG SOCKET ERRORS
    socket.on('error', function(){
        console.log('errors:', arguments);
    });
    
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
    
    
    // FUNCTIONS TO CHECK FOR ROWS
    
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
        }
    });



    // CHECK DRAW
    
    function check_draw(room, callback) {
        for(var val in games[room]['board'][0]) {
            if(val == 0)
                return;
        }
        callback();
    }

    
    // LEAVE ROOM
    socket.on('leave', function() {
        window.location = '/landingPage';
    });
});

console.log('Listening on port ' + process.env.PORT);
