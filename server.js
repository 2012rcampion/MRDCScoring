var express = require('express');
var http    = require('http');
var socket  = require('socket.io');
var fs      = require('fs');
var mongodb = require('mongodb');

//resources
var fieldFileName = __dirname + '/field.config';
var dbURL = 'mongodb://localhost:27017/jsdc';

//game parameters, all times in ms
var scoreInterval = 10*1000; //10s
var matchTime = 7*60*1000; //7m

var endBonusMultiplier = 10;

var rampValue = 10; //first time only
var doorValue = 10; //first time only
var coneValue = 10; //etc.
var wallValue = 10;

var personalFoulValue = -50;
var technicalFoulValue = -50;

//global objects
var field = {};
var teams = [];
var scores = [];
var db = {};

//global variables
var gameTime = matchTime;
var realTime = Date.now();
var running = false;

//setup functions
function parseField(err, data) {
	if(err) {
		return console.error(err);
	}
	lines = data.split('\n');
	
	var size = lines[0].split(',');
	
	field.width  = +(size[0]);
	field.height = +(size[1]);
	field.maxTeams  = +(size[2]);
	
	field.colors   = new Array(field.height);
	field.points   = new Array(field.height);
	field.indicies = new Array(field.height);
	field.squares  = [];
	field.adjacent = [];
	
	//read in the color/point value arrays
	for(var i = 0; i < field.height; i++) {
		var chars = lines[i+1].split(',');
		if(chars.length != field.width) {
			console.error('Warning, field is not the proper width on line '+(i+1));
			return;
		}
		field.colors[i]   = chars;
		var chars = lines[i+1+field.height].split(',');
		if(chars.length != field.width) {
			console.error('Warning, field is not the proper width on line '+(i+1+field.width));
			return;
		}
		field.points[i]   = chars;
		field.indicies[i] = new Array(field.width);
	}
	
	//read in the team corners and ramps
	field.teamCorners = new Array(field.maxTeams);
	field.ramps       = new Array(field.maxTeams);
	for(var i = 0; i < field.maxTeams; i++) {
		var coords = lines[i+1+2*field.height].split(',');
		for(var j = 0; j < 6; j++) {
			coords[j] = +(coords[j]);
		}
		field.teamCorners[i] = {row:coords[0], col:coords[1]};
		field.ramps[i] = {
			start:{row:coords[2], col:coords[3]},
			end:  {row:coords[4], col:coords[5]}
		};
	}
	
	//field is parsed, now create all of the structures we need
	var index = 0;

	// recursive method to find all contiguous territories
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

	//call the flood fill on each square
	for(var i = 0; i < field.height; i++) {
		for(var j = 0; j < field.width; j++) {
			//blank cells are not part of any territory
			if(field.colors[i][j] == ' ') {
				field.indicies[i][j] = -1;
			}
			else {
				//but skip squares that have already been filled
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

	// turn the color and point value matrices into lists indexed by territory id
	var colors2 = new Array(field.territories);
	var points2 = new Array(field.territories);
	for(var i = 0; i < field.territories; i++) {
		var s = field.squares[i][0];
		colors2[i] = field.colors[s.row][s.col];
		points2[i] = +(field.points[s.row][s.col]);
	}
	field.colors = colors2;
	field.points = points2;
	
	//also index the team corners by territory
	for(var i = 0; i < field.maxTeams; i++) {
		var coord = field.teamCorners[i];
		field.teamCorners[i] = field.indicies[coord.row][coord.col];
	}

	// find paths around all of the territory borders, for use in drawing
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

	//more field definitions
	field.state = new Array(field.territories);
	field.scoreTimers = new Array(field.territories);
	
	//all set, now set up the database connection:
	setImmediate(initDB);
}

function initDB() {
	mongoClient.connect(dbURL, function(err, database) {
		if(err) {
			return console.error(err);
		}
		console.log('Connected to ' + dbURL);
				
		database.collections(function(err, collections) {
			for(var i = 0; i < collections.length; i++) {
				db[collections[i].collectionName] = collections[i];
			}
			setImmediate(main);
		});
	});
}

//initialization functions
function initField() {
	for(var i = 0; i < field.territories; i++) {
		field.state[i] = -1;
		field.scoreTimers[i] = -1;
	}
	for(var i = 0; i < field.maxTeams; i++ ) {
		field.state[field.teamCorners[i]] = i;
		field.scoreTimers[field.teamCorners[i]] = -2;
	}
}

function initScores() {
	if(teams.length > field.maxTeams) {
		console.error("Warning: too many teams, truncating list");
		teams.length = field.maxTeams;
	}
	scores = new Array(teams.length);
	for(var i = 0; i < scores.length; i++) {
		scores[i] = {
			score: 0,
			ramp: false,
			door: false,
			cone: false,
			wall: false
		};
	}
}

//communication functions
function updateState() {
	io.sockets.emit('updateState', {
		'field':field,
		'teams':teams,
		'scores':scores
	});
}

function updateTime() {
	if(running) {
		var current = gameTime - (Date.now() - realTime);
		io.sockets.emit('updateTime', current);
	}
	else {
		io.sockets.emit('updateTime', gameTime);
	}
}

// ----- TEAMS -----

function updateTeams() {
	db.teams.find({}, function(err, cursor) {
		cursor.toArray(function(err, teams) {
			io.sockets.emit('updateTeams', teams)
		});
	});
}

function createTeam(data) {
	if(data.multiplier == 0) {
		data.multiplier = 1;
	}
	db.teams.insert(data, {w:1}, function(err, result) {
		console.log(result);
		updateTeams();
	});
}

function modifyTeam(data) {
	if(data.multiplier == 0) {
		data.multiplier = 1;
	}
	data._id = mongodb.ObjectID(data._id);
	db.teams.update({_id:data._id}, data, {w:1}, function(err, result) {
		console.log(result);
		updateTeams();
	});	
}

function removeTeam(data) {
	db.teams.remove({_id:mongodb.ObjectID(data)}, {w:1}, function(err, result) {
		console.log(result);
		updateTeams();
	});
}

// ----- UPCOMING -----

function updateUpcoming() {
	db.upcoming.find({}, {sort:'order'}, function(err, cursor) {
		cursor.toArray(function(err, upcoming) {
			io.sockets.emit('updateUpcoming', upcoming)
		});
	});
}

function reorderUpcoming(ids) {
	for(var i = 0; i < ids.length; i++) {
		db.upcoming.update({_id: mongodb.ObjectID(ids[i])}, {$set:{order:i}},
			{w:1}, function(err, result) {
				console.log(i);
			}
		);
	}
}

function addUpcomingTeam(data) {
	data._id = mongodb.ObjectID(data._id);
	db.upcoming.findAndModify({_id:data._id}, [['_id', 1]],
		{$push:{teams:data.team}}, {w:1}, function(err, result) {
			if(result.teams.length == 0) {
				db.upcoming.aggregate(
					{$group:{_id:1, max:{$max:"$order"}}},
					function(err, result) {
						db.upcoming.insert({teams:[], order:(result[0].max + 1)},
							{w:1}, function(err, result) {
								updateUpcoming();
							}
						);
					}
				);
			}
			else {
				updateUpcoming();
			}
		}
	);
}

function removeUpcomingTeam(data) {
	data._id = mongodb.ObjectID(data._id);
	console.log({_id:data._id});
	console.log({$pull:{teams:data.team}});
	db.upcoming.findAndModify({_id:data._id}, [['_id', 1]],
		{$pull:{teams:data.team}}, {w:1}, function(err, result) {
			if(err) {
				console.error(err);
				return;
			}
			console.log(err);
			console.log(result);
			if(result === null) {
				return;
			}
			if(result.teams.length == 1) {
				db.upcoming.remove({_id:data._id}, {w:1}, function(err, result) {
					updateUpcoming();
				});
			}
			else {
				updateUpcoming();
			}
		}
	);	
}

function popUpcoming() {
	db.upcoming.find({}, {sort:[['order', 1]]}, function(err, results) {
		results.nextObject(function(err, result) {
			for(var i = 0; i < result.teams.length; i++) {
				result.teams[i] = mongodb.ObjectID(result.teams[i]);
			}
			console.log(result);
			if(result.teams.length > 0) {
				db.teams.find({_id:{$in:(result.teams)}}, function(err, results) {
					results.toArray(function(err, results) {
						console.log(results);
						if(results.length == 0) {
							return;
						}
						teams = results;
						resetGame();
						db.upcoming.remove({_id:result._id}, {w:1}, function(err, results) {
							updateUpcoming();
						});
					});
				});
			}
			else {
				teams = [];
				resetGame();
			}
		});
	});
}

// ----- COMPLETED -----

function updateCompleted() {
	db.completed.find({}, function(err, cursor) {
		cursor.toArray(function(err, completed) {
			io.sockets.emit('updateCompleted', completed)
		});
	});
}

function pushCompleted() {
	if(teams.length == 0) {
		return popUpcoming();
	}
	db.completed.insert({'teams':teams, 'scores':scores, 'time':realTime},
		{w:1}, function(err, result) {
			teams = [];
			scores = [];
			updateCompleted();
			popUpcoming();
		}
	);
}

function removeCompleted(data) {
	db.completed.remove({_id:mongodb.ObjectID(data)}, {w:1}, function(err, result) {
		console.log(result);
		updateCompleted();
	});
}

//game actions
function startTimer() {
	if(gameTime <= 0 || running) {
		return;
	}
	var currentTime = Date.now();
	running = true;
	var offset = currentTime - realTime;
	for(var i = 0; i < field.territories; i++) {
		if(field.scoreTimers[i] > 0) {
			if(field.scoreTimers[i] > realTime) {
				field.scoreTimers[i] = currentTime;
			}
			else {
				field.scoreTimers[i] += offset;
			}
		}
	}
	realTime = currentTime;
}
		
function stopTimer() {
	if(!running) {
		return;
	}
	var currentTime = Date.now();
	running = false;
	gameTime -= currentTime - realTime; 
	realTime = currentTime;
}

function resetTimer() {
	stopTimer();
	gameTime = matchTime;
}

function setTimer(data) {
	var time = 0;
	var split = (''+data).split(':');
	for(var i = 0; i < split.length; i++) {
		time *= 60;
		time += +(split[i])
	}
	stopTimer();
	gameTime = 1000*time;
}

function resetGame() {
	resetTimer();
	initScores();
	initField();
	updateState();
	updateTime();
} 

function main() {
	// Start server
	server.listen(8080);
	console.log('Listening...');

	// Initialize game
	
	resetGame();
	
	/*initField();
	initTeams(field.maxTeams);
	teams[0].name = 'John Cleese';
	teams[1].name = 'Terry Gilliam';
	teams[2].name = 'Eric Idle';
	teams[3].name = 'Terry Jones';
	teams[0].multiplier = 10;*/

	//resetTimer();

	//tick function, runs at ~5Hz
	setInterval(function() {
		if(running) {
			var currentTime = Date.now();
			var update = false;
			if(gameTime - (currentTime - realTime) <= 0) {
				stopTimer();
				gameTime = 0;
				update = true;
				for(var i = 0; i < field.territories; i++) {
					if(field.scoreTimers[i] > 0) {
						scores[field.state[i]].score
								+= field.points[i]
								* teams[field.state[i]].multiplier
								* endBonusMultiplier;
						field.scoreTimers[i] = -1;
					}
				}
			}
			else {
				for(var i = 0; i < field.territories; i++) {
					if(
						field.scoreTimers[i] > 0
						&& currentTime - field.scoreTimers[i] > scoreInterval
					) {
						scores[field.state[i]].score
							+= field.points[i]
							* teams[field.state[i]].multiplier;
						field.scoreTimers[i] += scoreInterval;
						update = true;
					}
				}
			}
			updateTime();
			if(update) {
				updateState();
			}
		}
	}, 200);
	
	io.sockets.on('connection', function(socket) {
		//console.log(socket);
		setTimeout(function() {
			updateState();
			updateTeams();
			updateUpcoming();
			updateTime();
		},100);
			
		socket.on('capture', function(data) {
			var received = Date.now();
			if(data.team < 0 || data.team >= field.maxTeams) {
				return
			}
			//attempt to capture territory
			var index = field.indicies[data.row][data.col];
			if(index >= 0 && index < field.territories && field.teamCorners.indexOf(index) < 0) {
				//determine if territory can be captured via flood fill
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
					//'index' now belongs to 'team'
					field.state[index] = data.team;
					//deactivate all the territories
					for(var i = 0; i < field.state.length; i++) {
						if(field.state[i] >= 0) {
							field.state[i] = field.state[i] % field.maxTeams + field.maxTeams;
						}
					}
					//for each team, flood-fill activate the territories
					for(var team = 0; team < field.maxTeams; team++) {
						var corner = field.teamCorners[team];
						var next = [corner];
						while(next.length > 0) {
							var current = next.pop();
							if(field.state[current] != field.maxTeams + team) {
								continue;
							}
							field.state[current] = field.state[current] % field.maxTeams;
							if(field.scoreTimers[current] == -1) {
								//set timer
								field.scoreTimers[current] = received;
							}
							var adj = field.adjacent[current];
							for(var i = 0; i < adj.length; i++) {
								if(next.indexOf(adj[i]) < 0) {
									next.push(adj[i]);
								}
							}
						}
					}
					for(var i = 0; i < field.state.length; i++) {
						if(field.state[i] >= field.maxTeams) {
							//unset timer
							field.scoreTimers[i] = -1;
						}
					}
				}
			}
			updateState();
		});
		
		socket.on('capture', function(data) {
			var received = Date.now();
			if(data.team < 0 || data.team >= field.maxTeams) {
				return
			}
			//attempt to capture territory
			var index = field.indicies[data.row][data.col];
			if(index >= 0 && index < field.territories && field.teamCorners.indexOf(index) < 0) {
				//determine if territory can be captured via flood fill
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
					//'index' now belongs to 'team'
					field.state[index] = data.team;
					//deactivate all the territories
					for(var i = 0; i < field.state.length; i++) {
						if(field.state[i] >= 0) {
							field.state[i] = field.state[i] % field.maxTeams + field.maxTeams;
						}
					}
					//for each team, flood-fill activate the territories
					for(var team = 0; team < field.maxTeams; team++) {
						var corner = field.teamCorners[team];
						var next = [corner];
						while(next.length > 0) {
							var current = next.pop();
							if(field.state[current] != field.maxTeams + team) {
								continue;
							}
							field.state[current] = field.state[current] % field.maxTeams;
							if(field.scoreTimers[current] == -1) {
								//set timer
								field.scoreTimers[current] = received;
							}
							var adj = field.adjacent[current];
							for(var i = 0; i < adj.length; i++) {
								if(next.indexOf(adj[i]) < 0) {
									next.push(adj[i]);
								}
							}
						}
					}
					for(var i = 0; i < field.state.length; i++) {
						if(field.state[i] >= field.maxTeams) {
							//unset timer
							field.scoreTimers[i] = -1;
						}
					}
				}
			}
			updateState();
		});
		
		socket.on('startTimer', startTimer);
		socket.on('stopTimer', stopTimer);
		socket.on('resetTimer', resetTimer);
		socket.on('setTimer', setTimer);
		socket.on('resetGame', resetGame);
		
		socket.on('createTeam', createTeam);
		socket.on('modifyTeam', modifyTeam);
		socket.on('removeTeam', removeTeam);
		
		socket.on('addUpcomingTeam', addUpcomingTeam);
		socket.on('removeUpcomingTeam', removeUpcomingTeam);
		socket.on('reorderUpcoming', reorderUpcoming);
		socket.on('popUpcoming', popUpcoming);
		
		socket.on('pushCompleted', pushCompleted);
		socket.on('removeCompleted', removeCompleted);
	});
}

//initialize services
var app = express();
app.use(express.static(__dirname));

var server = http.createServer(app);

var io = socket.listen(server, {log: false});

var mongoClient = new mongodb.MongoClient(new mongodb.Server('localhost', 27017));

// Read in the config file, start the app
fs.readFile(fieldFileName, {encoding:'utf8'}, parseField);

/*function cueServerRampUp(index) {

}

function cueServerRampDown(index) {

}

//etc

*/