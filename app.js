var util = require('util');
var path = require('path');
var Promise = require('promise');
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var async = require('async');
var mongo = require('mongodb');

var db = require('./mongo.js');
var timer = require('./timer.js');

// imported explicitly now, but later will be called in
var gameDef = require('./game-def-2015.js');

timer.limit(gameDef.duration);

var globals = require('./globals.js');

//state = gameDef.initState(teams);



app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// log all requests

app.use(function(req, res, next) {
  //console.log(req.method, req.url);
  next();
});

// serve static files
app.use('/static', express.static(path.join(__dirname, 'static')));



// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({extended:true}));
// parse application/json
app.use(bodyParser.json());


app.use('/api', require('./api.js'));


app.get('/event', function(req, res) {
  var event = JSON.parse(req.query.event);
  event.team = req.query.team;
  console.log(' |- event =', event);
  state = gameDef.updateState(state, event);
  res.redirect('/scoreboard');
});


app.get('/teams', function(req, res, next) {
  db.done(function(db) {
    db.collection('teams').find().sort({'school':1, 'name':1}).toArray(function(err, docs) {
      res.render('teams', {
        teams: docs
      });
    });    
  });
});

app.get('/games', function(req, res, next) {
  db.done(function(db) {
    console.log('started parallel evaluation');
    async.parallel([
      function(callback) {
        db.collection('games').find().sort({'completed':1}).toArray(callback);
      },
      function(callback) {
        db.collection('teams').find().sort({'name':1}).toArray(callback);
      },
      function(callback) {
        globals.get('game-order').nodeify(callback)
      },
      function(callback) {
        globals.get('game-current').nodeify(callback)
      }
     ],
     function(err, docs) {
      if(err) {
        res.json(err);
        return;
      }
      var games = docs[0];
      var teams = docs[1];
      var order = docs[2];
      var current = docs[3];
      
      var gamesOrdered = [];
      
      var gamesCompleted = [];
      //var end = order.length;
      
      orderString = [];
      order.forEach(function(id, i) {
        orderString[i] = id.toHexString();
      });
      games.forEach(function(game) {
        var i = orderString.indexOf(game._id.toHexString());
        if(i < 0) {
          //gamesOrdered[end] = game;
          //end++;
          if(game._id.toHexString() == current.toHexString()) {
            gamesOrdered[0] = game;
          }
          else {
            gamesCompleted.push(game);
          }
        }
        else {
          gamesOrdered[i + 1] = game;
        }
      });
      
      
      var teamsMap = {};
      teams.forEach(function(team) {
        teamsMap[team._id] = team;
      });
      
      res.render('games', {
        gamesUpcoming: gamesOrdered,
        gamesFinished: gamesCompleted,
        current: current,
        teamsMap: teamsMap,
        teams: teams
      });
    });
  });
});


app.get('/events/:id', function(req, res, next) {
  var gameId = mongo.ObjectID(req.params.id);
  db.done(function(db) {
    console.log('started parallel evaluation');
    async.parallel([
      function(callback) {
        db.collection('events')
          .find({game:gameId})
          .sort({'clock':1})
          .toArray(callback);
      },
      function(callback) {
        db.collection('teams').find().sort({'name':1}).toArray(callback);
      },
      function(callback) {
        db.collection('games').findOne({_id:gameId}, callback);
      }
    ],
    function(err, docs) {
      if(err) {
        res.json(err);
        return;
      }
      var events = docs[0];
      var teams = docs[1];
      var game = docs[2];
      
      var teamsMap = {};
      teams.forEach(function(team) {
        teamsMap[team._id] = team;
      });
      
      res.render('events', {
        events: events,
        teamsMap: teamsMap,
        teams: teams,
        game: game,
        def: gameDef,
      });
    });
  });
});

app.get('/scoreboard', function(req, res, next) {
  db.done(function(db) {
    globals.get('game-current').done(function(gameID) {
      async.parallel([
        function(callback) {
          db.collection('events')
            .findOne(
              {game:gameID},
              {sort:{'clock':-1}},
              callback);
        },
        function(callback) {
          db.collection('teams').find().sort({'name':1}).toArray(callback);
        },
        function(callback) {
          db.collection('games').findOne({_id:gameID}, callback);
        },
        function(callback) {
          db.collection('games').find().sort({'completed':1}).toArray(callback);
        },
        function(callback) {
          globals.get('game-order').nodeify(callback)
        },
      ],
      function(err, docs) {
        if(err) {
          res.json(err);
          return;
        }
        var event = docs[0];
        var teams = docs[1];
        var game  = docs[2];
        var games = docs[3];
        var order = docs[4];
        
        var teamsMap = {};
        teams.forEach(function(team) {
          teamsMap[team._id] = team;
        });
        
        var gamesOrdered = [];
      
        orderString = [];
        order.forEach(function(id, i) {
          orderString[i] = id.toHexString();
        });
        games.forEach(function(game) {
          var i = orderString.indexOf(game._id.toHexString());
          if(i < 0) {
            //gamesOrdered[end] = game;
            //end++;
          }
          else {
            gamesOrdered[i] = game;
          }
        });
        
        var state;
        if(event) {
          state = event.state;
        }
        else {
          state = gameDef.initState(game.teams);
        }
        
        res.render('scoreboard', {
          teamsMap: teamsMap,
          state: state,
          def: gameDef,
          realtime:Date.now(),
          gametime:timer.get(gameDef.countdown),
          countdown:timer.running(),
          games: gamesOrdered
        });
      });
    });
  });
});


// catchall 404
app.get('*', function(req, res) {
  res.status(404).send();
});

var server;
var sockets = {}; // object to hold sockets in
var socketid = 0; // socket id counter
  
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

// exit gracefully on ctrl-c
function exitGracefully() {
  console.log('\nShutting down...');
  server.close(function() {
    console.log('Closed server');
    db.done(function(db) {
      db.close(function() {
        console.log('Closed database, exiting now');
        process.exit();
      });
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
