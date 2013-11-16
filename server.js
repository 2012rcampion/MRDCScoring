var express = require('express');
var http = require('http');
var socket = require('socket.io');
var fs = require('fs');

fs.readFile(__dirname + '/field.config', 'utf8', function(err, data) {
	if(err) {
		return console.log(err);
	}
	console.log(data);
});

/*
h = First[Dimensions[full]];
w = Last[Dimensions[full]];
map = ConstantArray[0, Dimensions[full]];
territories = {};
adjacency = {};
index = 1;
floodFill[i_, j_, type_, idx_] :=
 If[0 < i <= h && 0 < j <= w && full[[i, j]] > 0,
  If[map[[i, j]] > 0,
   If[map[[i, j]] != idx,
    AppendTo[adjacency[[idx]], map[[i, j]]]
    ],
   If[full[[i, j]] == type,
    map[[i, j]] = idx;
    AppendTo[territories[[idx]], {i, j}];
    floodFill[i + 1, j, type, idx];
    floodFill[i - 1, j, type, idx];
    floodFill[i, j + 1, type, idx];
    floodFill[i, j - 1, type, idx]]
   ]
  ]
Do[
 If[full[[i, j]] < 1,
  map[[i, j]] = 0,
  If[map[[i, j]] == 0,
   AppendTo[territories, {}];
   AppendTo[adjacency, {}];
   floodFill[i, j, full[[i, j]], index++]
   ]],
 {i, h},
 {j, w}]
Do[AppendTo[adjacency[[j]], i], {i, index - 1}, {j, adjacency[[i]]}];
Do[adjacency[[i]] = Union[adjacency[[i]]], {i, index - 1}]
*/

var app = express();
var server = http.createServer(app);
var io = socket.listen(server);

server.listen(80);


app.get('/', function (req, res) {
	res.sendfile(__dirname + '/index.html');
});

app.get('/jquery.js', function(req, res) {
	res.sendfile(__dirname + '/jquery-1.10.2.js');
});

io.sockets.on('connection', function (socket) {
	var x0, y0;
	
	socket.emit('news', { hello: 'world' });
	socket.on('down', function (data) {
		console.log(data);
		x0 = data.x;
		y0 = data.y;
	});
	socket.on('up', function (data) {
		console.log(data);
		socket.emit('draw', {x:x0, y:y0, w:data.x-x0, h:data.y-y0})
	});
});