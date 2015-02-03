var util = require('util');
var path = require('path');
var express = require('express');
var app = express();
var bodyParser = require('body-parser');

var mongo = require('./mongo.js');

// imported explicitly now, but later will be called in
var gameDef = require('./game-def-2015.js');

// temporary game state initialization, bypassing database
var teamName = {
  '1':'Nationals',
  '2':'Cubs',
  '3':'Giants',
  '4':'Phillies'
};

var teams = ['1', '2', '3', '4'];

state = gameDef.initState(teams);

console.log('initial game state:', state);

// setup jade views

var view_names = {
  'scoreboard':'Scoreboard',
  'admin':'Administrator',
  'jade_test':'Hello World',
  'teams':'Teams'
};

console.log('Views');
for(var view in view_names) {
  console.log(' |- %s => %s', view, view_names[view]);
}

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// log all requests

app.use(function(req, res, next) {
  console.log(req.method, req.url);
  next();
});

// serve static files
app.use('/static', express.static(path.join(__dirname, 'static')));

var api = express.Router();

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({extended:true}));
// parse application/json
app.use(bodyParser.json());

// log request body
api.use(function(req, res, next) {
  console.log('req.body =', req.body);
  next();
});

// convert every instance of the id paramater to mongodb id format
api.param('id', function(req, res, next, id){
  req.id = mongo.ObjectID(id);
  next();
});

/*
*    /!\ WARNING /!\
* 
*  API LACKS VALIDATION
*
*    /!\ WARNING /!\
*/

api.route('/teams')
  .get(function(req, res) {
    mongo.teams.find().toArray(function(err, docs) {
      res.json(docs);
    });
  })
  .post(function(req, res) {
    var team = req.body;
    mongo.teams.insertOne(team, function(err, doc) {
      res.json(err?err:doc);
    });
  });
api.route('/teams/:id')
  .get(function(req, res) {
    mongo.teams.findOne({_id:req.id}, function(err, doc) {
      res.json(err?err:doc);
    });
  })
  .put(function(req, res) {
    var team = req.body;
    mongo.teams.updateOne({_id:req.id}, {$set:team}, function(err, doc) {
      res.json(err?err:doc);
    });
  })
  .delete(function(req, res) {
    mongo.teams.deleteOne({_id:req.id}, function(err) {
      res.json(err?err:{ok:true});
    });
  });

// define api for matches

// de-json-ify body parameters (turns out body-parser
// already does this with qt when extended:true is set
/*api.use('/games', function(req, res, next) {
  req.body.teams = JSON.parse(req.body.teams
  next();
});*/

api.route('/games')
  .get(function(req, res) {
    mongo.games.find().toArray(function(err, docs) {
      res.json(docs);
    });
  })
  .post(function(req, res) {
    var game = req.body;
    mongo.games.insertOne(game, function(err, doc) {
      res.json(err?err:doc);
    });
  });
api.route('/games/:id')
  .get(function(req, res) {
    mongo.games.findOne({_id:req.id}, function(err, doc) {
      res.json(err?err:doc);
    });
  })
  .put(function(req, res) {
    var game = req.body;
    mongo.games.updateOne({_id:req.id}, {$set:game}, function(err, doc) {
      res.json(err?err:doc);
    });
  })
  .delete(function(req, res) {
    mongo.games.deleteOne({_id:req.id}, function(err) {
      res.json(err?err:{ok:true});
    });
  });

// define api for events

api.route('/events')
  .get(function(req, res) {
    mongo.events.find().toArray(function(err, docs) {
      res.json(docs);
    });
  })
  .post(function(req, res) {
    var event = req.body;
    mongo.events.insertOne(event, function(err, doc) {
      res.json(err?err:doc);
    });
  });
api.route('/events/:id')
  .get(function(req, res) {
    mongo.events.findOne({_id:req.id}, function(err, doc) {
      res.json(err?err:doc);
    });
  })
  .put(function(req, res) {
    var event = req.body;
    mongo.events.updateOne({_id:req.id}, {$set:event}, function(err, doc) {
      res.json(err?err:doc);
    });
  })
  .delete(function(req, res) {
    mongo.events.deleteOne({_id:req.id}, function(err) {
      res.json(err?err:{ok:true});
    });
  });

app.use('/api', api);

app.get('/', function(req, res){
  res.render('layout', {
    title: 'Home',
    views: view_names
  });
});

app.get('/event', function(req, res) {
  var event = JSON.parse(req.query.event);
  event.team = req.query.team;
  console.log(' |- event =', event);
  state = gameDef.updateState(state, event);
  res.redirect('/scoreboard');
});

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

// catchall 404
app.get('*', function(req, res) {
  res.status(404).send();
});

var server;
var sockets = {}; // object to hold sockets in
var socketid = 0; // socket id counter
mongo.init(function() {
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
    mongo.db.close(function() {
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
