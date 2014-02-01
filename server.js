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
					field.squares[idx].push({'row':i, 'col':j});
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
	
	field.state = new Array(field.squares.length);
	for(var i = 0; i < field.state.length; i++) {
		field.state[i] = -1;
	}
	
	field.teamCorners = [
		field.indicies[0][0],
		field.indicies[0][field.width-1],
		field.indicies[field.height-1][field.width-1],
		field.indicies[field.height-1][0]		
	];
	
	field.teams = field.teamCorners.length;
	
	for(var i = 0; i < field.teams; i++ ) {
		field.state[field.teamCorners[i]] = i;
	}
	
	for(var i = 0; i < field.adjacent.length; i++) {
		
	}
	
	console.log(field);
});

var app = express();
var server = http.createServer(app);
var io = socket.listen(server);

server.listen(80);

/*app.get('/', function (req, res) {
	res.sendfile(__dirname + '/index.html');
});

app.get('/jquery.js', function(req, res) {
	res.sendfile(__dirname + '/jquery-1.10.2.js');
});*/
app.use(express.static(__dirname));

io.sockets.on('connection', function (socket) {
	socket.emit('stateUpdate', {'field':field})
	
	socket.on('scoreEvent', function (data) {
		console.log(data);
		if(data.team < 0 || data.team >= field.teams) {
			return
		}
		if(data.type == 'capture') {
			var index = field.indicies[data.row][data.col];
			if(index >= 0 && field.teamCorners.indexOf(index) < 0) {
				var corner = field.teamCorners[data.team];
				var visited = [index];
				var next = field.adjacent[index].slice(0);
				var success = false;
				while(next.length > 0) {
					var current = next.pop();
					if(current == corner) {
						success = true;
						break;
					}
					if(field.state[current] != data.team) {
						continue;
					}
					visited.push(current);
					var adj = field.adjacent[current];
					for(var i = 0; i < adj.length; i++) {
						if(visited.indexOf(adj[i]) < 0 && next.indexOf(adj[i]) < 0) {
							next.push(adj[i]);
						}
					}
				}
				if(success) {
					field.state[index] = data.team;
					for(var i = 0; i < field.state.length; i++) {
						if(field.state[i] >= 0) {
							field.state[i] = field.state[i] % field.teams + field.teams;
						}
					}
					for(var team = 0; team < field.teams; team++) {
						var corner = field.teamCorners[team];
						//var visited = [];
						var next = [corner];
						while(next.length > 0) {
							var current = next.pop();
							if(field.state[current] != field.teams + team) {
								continue;
							}
							field.state[current] = field.state[current] % field.teams;
							//visited.push(current);
							var adj = field.adjacent[current];
							for(var i = 0; i < adj.length; i++) {
								if(/*visited.indexOf(adj[i]) < 0 &&*/ next.indexOf(adj[i]) < 0) {
									next.push(adj[i]);
								}
							}
						}
					}
				}
			}
		}
		socket.emit('stateUpdate', {'field':field});
	});
});