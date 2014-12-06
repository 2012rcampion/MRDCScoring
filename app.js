var util = require('util');
var path = require('path');
var express = require('express');
var app = express();
var mongo = require('./mongo.js');

var view_names = {
  'scoreboard':'Scoreboard',
  'admin':'Administrator',
  'jade_test':'Hello World'
};

console.log('Views');
for(var view in view_names) {
  console.log(' |- %s => %s', view, view_names[view]);
}

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(function(req, res, next) {
  console.log(new Date().toISOString(), ':', req.url);
  next();
});

app.get('/', function(req, res){
  res.redirect('/scoreboard');
});

app.use('/:page', function (req, res, next) {
  var view = req.params.page;
  if(view in view_names) {
    mongo.db.collection('teams').find().toArray(function(err, docs) {
      res.render(view, {
        title: view_names[view],
        views: view_names,
        docs: JSON.stringify(docs)
      });
    });
  }
  else {
    next();
  }
});


app.get('*', function(req, res) {
  res.status(404).send();
});

var server;
mongo.init(function() {
  server = app.listen(8080, function() {
    console.log('Listening on port %d', server.address().port);
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
  // set a timeout to kill processes 
  setTimeout(function() {
    console.error('Closing connections timed out, exiting anyway');
    process.exit();
  }, 3000);
}

process.on('SIGINT',  exitGracefully);
process.on('SIGTERM', exitGracefully);
