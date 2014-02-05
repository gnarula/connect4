$(document).ready(function() {
    for(var i = 0; i < 6; i++){
        $('#board table').append('<tr></tr>');
        for(var j = 0; j < 7; j++) {
            $('#board tr').last().append('<td></td>');
            $('#board td').last().addClass('box').attr('data-row', i).attr('data-column', j);
        }
    }

    var socket = io.connect('localhost');

    function Player(room, pid) {
        this.room = room;
        this.pid = pid;
    }

    var room = $('input').data('room');
    var player = new Player(room, '', '');

    socket.on('connect', function() {
        socket.emit('join', {room: room});
    });

    socket.on('assign', function(data) {
        player.color = data.color;
        player.pid = data.pid;
        if(player.pid == 1) {
            $('.p1-score p').addClass('current');
        }
        else {
            $('.p2-score p').addClass('current');
        }
    });

    socket.on('leave', function() {
        window.location = '/landingPage';
    });

    socket.on('notify', function(data) {
        if(data.connected == 1) {
            if(data.turn)
                alertify.success('Players Connected! Your turn');
            else
                alertify.success('Players Connected! Opponent\'s turn');
        }
    });
});