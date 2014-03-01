var express = require('express');
var http    = require('http');
var socket  = require('socket.io');
var fs      = require('fs');

var scoreInterval = 10;

var fieldFileName = __dirname + '/field.config';

try {
	var lines = fs.readFileSync(fieldFileName, 'utf8').split('\n');
}
catch(e) {
	console.error('error reading config file ' + fieldFileName);
	process.exit(1);
}

var height_width = lines[0].split(',');

var field = {};

field.height = parseInt(height_width[0]);
field.width  = parseInt(height_width[1]);

field.colors   = new Array(field.height);
field.points   = new Array(field.height);
field.indicies = new Array(field.height);
field.squares  = [];
field.adjacent = [];

for(var i = 0; i < field.height; i++) {
	var chars = lines[i+1].split(',');
	if(chars.length != field.width) {
		console.error('Warning, field is not the proper width on line '+(i+1));
		process.exit();
	}
	field.colors[i]   = chars;
	var chars = lines[i+1+field.height].split(',');
	if(chars.length != field.width) {
		console.error('Warning, field is not the proper width on line '+(i+1+field.width));
		process.exit();
	}
	field.points[i]   = chars;
	field.indicies[i] = new Array(field.width);
}


var index = 0;

function floodFill(i, j, type, idx) {
	if(0 <= i && i < field.height && 0 <= j && j < field.width && field.colors[i][j] != ' ') {
		if(field.indicies[i][j] >= 0) {
			var newidx = field.indicies[i][j];
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

field.territories = field.squares.length;

var colors2 = new Array(field.territories);
var points2 = new Array(field.territories);
for(var i = 0; i < field.territories; i++) {
	var s = field.squares[i][0];
	colors2[i] = field.colors[s.row][s.col];
	points2[i] = +(field.points[s.row][s.col]);
}
field.colors = colors2;
field.points = points2;

field.borders = new Array(field.territories);
for(var i = 0; i < field.territories; i++) {
	var border = []
	for(var j = 0; j < field.squares[i].length; j++) {
		var s = field.squares[i][j];
		var toAdd = [
			[{x:s.col,   y:s.row},   {x:s.col+1, y:s.row}],
			[{x:s.col+1, y:s.row},   {x:s.col+1, y:s.row+1}],
			[{x:s.col+1, y:s.row+1}, {x:s.col,   y:s.row+1}],
			[{x:s.col,   y:s.row+1}, {x:s.col,   y:s.row}]
		]
		for(var k = 0; k < 4; k++) {
			var replace = true;
			var a = toAdd[k];
			for(var l = 0; l < border.length; l++) {
				var b = border[l];
				//console.log(a,b);
				if(a[0].x == b[1].x && a[0].y == b[1].y &&
				   a[1].x == b[0].x && a[1].y == b[0].y) {
					border.splice(l, 1);
					replace = false;
					break;
				}
			}
			if(replace) {
				border.push(toAdd[k]);
			}
		}
	}
	field.borders[i] = border.pop();
	var last = field.borders[i][1];
	while(border.length > 1) {
		for(var j = 0; j < border.length; j++) {
			if(border[j][0].x == last.x && border[j][0].y == last.y) {
				last = border[j][1];
				border.splice(j,1);
				field.borders[i].push(last);
				break;
			}
		}
	}
}

field.state = new Array(field.territories);
field.scoreTimers = new Array(field.territories);

field.teamCorners = [
	field.indicies[0][0],
	field.indicies[0][field.width-1],
	field.indicies[field.height-1][0],
	field.indicies[field.height-1][field.width-1]
];

field.maxTeams = field.teamCorners.length;

function initField() {
	for(var i = 0; i < field.territories; i++) {
		field.state[i] = -1;
		field.scoreTimers[i] = undefined;
	}
	for(var i = 0; i < field.maxTeams; i++ ) {
		field.state[field.teamCorners[i]] = i;
		field.scoreTimers[field.teamCorners[i]] = "corner";
	}
}
initField();
console.log('Field OK');

var teams = new Array(field.maxTeams);

function initTeams(numTeams) {
	if(numTeams > field.maxTeams) {
		console.error('Too many teams');
		teams.length = field.maxTeams;
	}
	else {
		teams.length = numTeams;
	}
	for(var i = 0; i < teams.length; i++) {
		teams[i] = {
			score: 0,
			multiplier: 1
		};
	}
}

initTeams(4);
teams[0].name = 'John Cleese';
teams[1].name = 'Terry Gilliam';
teams[2].name = 'Eric Idle';
teams[3].name = 'Terry Jones';
console.log('Teams OK');

var app = express();
var server = http.createServer(app);
var io = socket.listen(server, {log: false});

server.listen(8080);
console.log('Listening OK');

/*app.get('/', function (req, res) {
	res.sendfile(__dirname + '/index.html');
});

app.get('/jquery.js', function(req, res) {
	res.sendfile(__dirname + '/jquery-1.10.2.js');
});*/
app.use(express.static(__dirname));

stateUpdate = function() {
	io.sockets.emit('stateUpdate', {
		'field':{
			'territories':field.territories,
			'state':field.state,
			'colors':field.colors,
			'borders':field.borders
		},
		'teams':teams
	});
}

io.sockets.on('connection', function (socket) {
	//console.log(socket);
	stateUpdate();
	
	socket.on('scoreEvent', function (data) {
		//console.log(data);
		if(data.team < 0 || data.team >= field.maxTeams) {
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
							field.state[i] = field.state[i] % field.maxTeams + field.maxTeams;
						}
					}
					for(var team = 0; team < field.maxTeams; team++) {
						var corner = field.teamCorners[team];
						//var visited = [];
						var next = [corner];
						while(next.length > 0) {
							var current = next.pop();
							if(field.state[current] != field.maxTeams + team) {
								continue;
							}
							field.state[current] = field.state[current] % field.maxTeams;
							if(field.scoreTimers[current] == undefined) {
								field.scoreTimers[current] = setInterval(
									function(territory) {
										teams[field.state[territory]].score +=
											field.points[territory];
										stateUpdate();
									},
									1000*scoreInterval,
									current
								);
								//console.log(field.scoreTimers[current]);
							}
							//visited.push(current);
							var adj = field.adjacent[current];
							for(var i = 0; i < adj.length; i++) {
								if(/*visited.indexOf(adj[i]) < 0 &&*/ next.indexOf(adj[i]) < 0) {
									next.push(adj[i]);
								}
							}
						}
					}
					for(var i = 0; i < field.state.length; i++) {
						if(field.state[i] >= field.maxTeams) {
							clearInterval(field.scoreTimers[i]);
							field.scoreTimers[i] = undefined;
						}
					}
				}
			}
		}
		stateUpdate();
	});
});
