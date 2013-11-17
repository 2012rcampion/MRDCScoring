var express = require('express');
var http    = require('http');
var socket  = require('socket.io');
var fs      = require('fs');

var field = {};

fs.readFile(__dirname + '/field.config', 'utf8', function(err, data) {
	if(err) {
		return console.log(err);
	}
	var lines = data.split('\n');
	var height_width = lines[0].split(',');
	
	field.height = parseInt(height_width[0]);
	field.width  = parseInt(height_width[1]);
	
	field.colors   = new Array(field.height);
	field.indicies = new Array(field.height);
	field.squares  = []
	field.adjacent = []
	
	for(var i = 0; i < field.height; i++) {
		var chars = lines[i+1].split('');
		if(chars.length != field.width) {
			console.error("Warning, field is not the proper width.");
		}
		field.colors[i]   = chars;
		field.indicies[i] = new Array(field.width);
	}
	
	console.log(field);
	
	
	var index = 0;
	
	function floodFill(i, j, type, idx) {
		if(0 <= i && i < field.height && 0 <= j && j < field.width && field.colors[i][j] != ' ') {
			if(field.indicies[i][j] >= 0) {
				var newidx = field.indicies[i][j];
				console.log(newidx);
				if(newidx != idx) {
					if(field.adjacent[idx].indexOf(newidx) < 0) {
						field.adjacent[idx].push(newidx);
					}
					if(newidx < idx && field.adjacent[newidx].indexOf(idx) < 0) {
						field.adjacent[newidx].push(idx);
					}
				}
			}
			else {
				if(field.colors[i][j] == type) {
					field.indicies[i][j] = idx;
					field.squares[idx].push({'i':i, 'j':j});
					floodFill(i-1, j, type, idx);
					floodFill(i+1, j, type, idx);
					floodFill(i, j-1, type, idx);
					floodFill(i, j+1, type, idx);
				}
			}
		}
	}
			
	for(var i = 0; i < field.height; i++) {
		for(var j = 0; j < field.width; j++) {
			if(field.colors[i][j] == ' ') {
				field.indicies[i][j] = -1;
			}
			else {
				if(!(field.indicies[i][j] >= 0)) {
					field.squares.push([]);
					field.adjacent.push([]);
					floodFill(i, j, field.colors[i][j], index);
					index++;
				}
			}
		}
	}
	
	for(var i = 0; i < field.adjacent.length; i++) {
		
	}
					
				
/*		
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
	
	console.log(field);
});



/*
h = First[Dimensions[full]];
w = Last[Dimensions[full]];
map = ConstantArray[0, Dimensions[full]];
territories = {};
adjacency = {};
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