var express = require('express');
var async = require('async');
var app = express()
var io = require('socket.io').listen(app.listen(8000));

app.use('/static', express.static(__dirname + '/static'));

app.get('/', function(req, res) {
    res.render('index.jade');
});

app.get('/landingPage', function(req, res) {
    res.render('landing.jade');
});

console.log('Listening on port 8000');