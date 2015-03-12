var util = require('util');
var path = require('path');
var Promise = require('promise');
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var async = require('async');

var db = require('./mongo.js');

// imported explicitly now, but later will be called in
var gameDef = require('./game-def-2015.js');

var globals = require('./globals.js');

//state = gameDef.initState(teams);



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
    db.teams.find().toArray(function(err, docs) {
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
      
      var end = order.length;
      
      console.log(order);
      
      orderString = [];
      order.forEach(function(id, i) {
        orderString[i] = id.toHexString();
      });
      games.forEach(function(game) {
        var i = orderString.indexOf(game._id.toHexString());
        if(i < 0) {
          gamesOrdered[end] = game;
          end++;
        }
        else {
          gamesOrdered[i] = game;
        }
      });
      
      
      console.log(gamesOrdered);
      
      var teamsMap = {};
      teams.forEach(function(team) {
        teamsMap[team._id] = team;
      });
      
      res.render('games', {
        games: gamesOrdered,
        current: current,
        teamsMap: teamsMap,
        teams: teams
      });   
      
      console.log('rendered') 
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
