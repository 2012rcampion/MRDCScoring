var util = require('util');
var path = require('path');
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var async = require('async');

var db = require('./mongo.js');

// imported explicitly now, but later will be called in
var gameDef = require('./game-def-2015.js');

var globals = require('./globals.js');

//state = gameDef.initState(teams);

// -setup jade views-
// handling all the views automatically?  haha nope
/*
var view_names = {
  'scoreboard':'Scoreboard',
  'admin':'Administrator',
  'jade_test':'Hello World',
  'teams':'Teams'
};

console.log('Views');
for(var view in view_names) {
  console.log(' |- %s => %s', view, view_names[view]);
}*/

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// log all requests

app.use(function(req, res, next) {
  console.log(req.method, req.url);
  next();
});

// serve static files
app.use('/static', express.static(path.join(__dirname, 'static')));



// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({extended:true}));
// parse application/json
app.use(bodyParser.json());


app.use('/api', require('./api.js')(db, global, gameDef));

/*app.get('/', function(req, res){
  res.render('layout', {
    title: 'Home',
    views: view_names
  });
});*/

app.get('/event', function(req, res) {
  var event = JSON.parse(req.query.event);
  event.team = req.query.team;
  console.log(' |- event =', event);
  state = gameDef.updateState(state, event);
  res.redirect('/scoreboard');
});


app.get('/teams', function(req, res, next) {
  db.teams.find().toArray(function(err, docs) {
    res.render('teams', {
      teams: docs
    });    
  });
});

app.get('/games', function(req, res, next) {
  async.parallel([
    function(callback) {
      db.games.find().sort({'order': 1, 'completed':1}).toArray(callback);
    },
    function(callback) {
      db.teams.find().sort({'name':1}).toArray(callback);
    }
   ], function(err, docs) {
    if(err) {
      res.json(err);
      return;
    }
    var pastGames = [];
    var futureGames = [];
    docs[0].forEach(function(game) {
      if(game.order < 0) {
        pastGames.push(game);
      }
      else {
        futureGames.push(game);
      }
    });
    if(futureGames.length > 0) {
      currentGame = futureGames.shift();
    }
    var teamsMap = {};
    var teamsList = [];
    docs[1].forEach(function(team) {
      teamsMap[team._id] = team;
      teamsList.push(team._id);
    });
    
    res.render('games', {
      pastGames:   pastGames,
      currentGame: currentGame,
      futureGames: futureGames,
      teamsMap:  teamsMap,
      teamsList: teamsList
    });    
  });
});

// handling all the views automatically?  haha nope
/*
app.use('/:page', function (req, res, next) {
  var view = req.params.page;
  if(view in view_names) {
    res.render(view, {
      title: view_names[view],
      views: view_names,
      teams: teams,
      teamNames: teams.map(function(t){ return teamName[t]; }),
      state: gameDef.renderState(state),
      events: gameDef.events.map(JSON.stringify),
      controls: gameDef.events.map(gameDef.renderControl)
    });
  }
  else {
    next();
  }
});
*/

// catchall 404
app.get('*', function(req, res) {
  res.status(404).send();
});

var server;
var sockets = {}; // object to hold sockets in
var socketid = 0; // socket id counter
db.init(function() {
  
  globals.get('game-current', console.log)
  
  server = app.listen(8080, function() {
    console.log('Listening on port %d', server.address().port);
  });
  // monitor sockets
  server.on('connection', function(socket) { // on connection
    var id = (socketid++); // increment id and store in closure
    sockets[id] = socket; // store the socket in case we need to close it later
    console.log('socket #%d now open', id);
    // monitor for socket close event and report
    socket.on('close', function(error) {
      delete sockets[id]; // remove from list
      console.log('socket #%d closed with%s error', id, error?' an':'out');
    });
  });
});

// exit gracefully on ctrl-c
function exitGracefully() {
  console.log('\nShutting down...');
  server.close(function() {
    console.log('Closed server');
    db.db.close(function() {
      console.log('Closed database, exiting now');
      process.exit();
    });
  });
  console.log('end()ing open sockets...');
  for(var id in sockets) {
    sockets[id].end();
  }
  // set a timeout to kill process if we're stuck 
  setTimeout(function() {
    console.error('Closing connections timed out, exiting anyway');
    process.exit();
  }, 10*1000);
}

process.on('SIGINT',  exitGracefully);
process.on('SIGTERM', exitGracefully);
