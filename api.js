var express = require('express');
var mongo = require('mongodb');

var db = require('./mongo.js');
var globals = require('./globals');
var gameDef = require('./game-def-2015.js');

var api = express.Router();

// log request body
api.use(function(req, res, next) {
  console.log('req.body =', req.body);
  next();
});

// convert every instance of the id paramater to mongodb id format
api.param('id', function(req, res, next, id) {
  req.id = mongo.ObjectID(id);
  next();
});

api.param('team', function(req, res, next, id) {
  req.teamID = mongo.ObjectID(id);
  next();
});



api.route('/teams')
  .get(function(req, res) {
    db.done(function(db) {
      db.collection('teams').find().toArray(function(err, docs) {
        res.json(docs);
      });
    });
  })
  .post(function(req, res) {
    var team = req.body;
    db.done(function(db) {
      db.collection('teams').insertOne(team, function(err, doc) {
        res.json(err?err:doc);
      });
    });
  });
api.route('/teams/:id')
  .get(function(req, res) {
    db.done(function(db) {
      db.collection('teams').findOne({_id:req.id}, function(err, doc) {
        res.json(err?err:doc);
      });
    });
  })
  .put(function(req, res) {
    var team = req.body;
    db.done(function(db) {
      db.collection('teams')
      .updateOne({_id:req.id}, {$set:team}, function(err, doc) {
        res.json(err?err:doc);
      });
    });
  })
  .delete(function(req, res) {
    db.done(function(db) {
      db.collection('teams').deleteOne({_id:req.id}, function(err) {
        res.json(err?err:{ok:true});
      });
    });
  });

// define api for matches

// de-json-ify body parameters
// turns out body-parser already does this with qs when extended:true is set
/*api.use('/games', function(req, res, next) {
  req.body.teams = JSON.parse(req.body.teams
  next();
});*/

api.route('/games')
  .get(function(req, res) {
    db.done(function(db) {
      db.collection('games').find().toArray(function(err, docs) {
        res.json(docs);
      });
    });
  })
  .post(function(req, res) {
    var game = req.body;
    db.done(function(db) {
      db.collection('games').insertOne(game, function(err, doc) {
        res.json(err?err:doc);
      });
    });
  });
api.route('/games/:id')
  .get(function(req, res) {
    db.done(function(db) {
      db.collection('games').findOne({_id:req.id}, function(err, doc) {
        res.json(err?err:doc);
      });
    });
  })
  .put(function(req, res) {
    var game = req.body;
    db.done(function(db) {
      db.collection('games').updateOne({_id:req.id}, {$set:game},
        function(err, doc) {
          res.json(err?err:doc);
        });
    });
  })
  .delete(function(req, res) {
    db.done(function(db) {
      db.collection('games').deleteOne({_id:req.id}, function(err) {
        res.json(err?err:{ok:true});
      });
    });
  });
api.route('/games/:id/teams')
  .get(function(req, res) {
    db.done(function(db) {
      db.collection('games').findOne({_id:req.id}, function(err, doc) {
        res.json(err?err:(doc.teams));
      });
    });
  }).post(function(req, res) {
    if(!req.body.team) {
      res.json({ok:false, reason:"No team specified!"});
      return;
    }
    db.done(function(db) {
      db.collection('games')
      .updateOne({_id:req.id}, {$addToSet:{teams:req.body.team}},
        function(err, doc) {
          res.json(err?err:doc);
        });
    });
    
  });
api.route('/games/:id/teams/:team')
  .delete(function(req, res) {
    db.done(function(db) {
      db.collection('games')
      .updateOne({_id:req.id}, {$pull:{teams:req.body.teamID}},
        function(err) {
          res.json(err?err:{ok:true});
        });
    });
  });

// define api for events

function updateEventsFrom(gameID, gameTime) {
  db.then(function(db) {
    db.collection('events')
    .findOne(
      {'game':mongo.ObjectId(gameID), $lt:{'game-time':gameTime}},
      {sort:[['game-time', -1]]},
      function(err, first) {
        var startingState;
        if(first == null) {
          startingState = new Promise(function(resolve, reject) {
            db.collection('games').findOne({'_id':MongoId(gameID)},
              function(err, game) {
                if(err) {
                  return reject(Error(err));
                }
                if(game == null) {
                  return reject(Error("game-current is invalid!"));
                }
                resolve(gameDef.initState(game.teams));
              });
          });
        }
        else {
          startingState = Promise.resolve(first.state);
        }
        
        startingState.done(function(state) {
          db.collection('events')
            .find({
              'game':mongo.ObjectId(gameID),
              $gte:{'game-time':gameTime}
            })
            .sort([['game-time', 1]])
            .each(function(event) {
              state = gameDef.updateState(state, event);
              db.collection('events')
                .update(
                  {'_id':event.id},
                  {$set:{'state':state}},
                  function() {}
                );
            });
          });
      });
  });
}


api.route('/events')
  .get(function(req, res) {
    db.done(function(db) {
      db.collection('events').find().toArray(function(err, docs) {
        res.json(docs);
      });
    });
  })
  .post(function(req, res) {
    var event = req.body;
    
    db.done(function(db) {
      db.collection('events').insertOne(event, function(err, doc) {
        res.json(err?err:doc);
        updateEventsFrom(event.game, event['game-time']);
      });
    });
  });
api.route('/events/:id')
  .get(function(req, res) {
    db.done(function(db) {
      db.collection('events').findOne({_id:req.id}, function(err, doc) {
        res.json(err?err:doc);
      });
    });
  })
  .put(function(req, res) {
    var event = req.body;
    db.done(function(db) {
      db.collection('events')
        .updateOne({_id:req.id}, {$set:event}, function(err, doc) {
          res.json(err?err:doc);
          db.collection('events').findOne({_id:req.id},
            function(err, updatedEvent) {
              updateEventsFrom(updatedEvent.game, updatedEvent['game-time']);
            });
            
        });
    });
  })
  .delete(function(req, res) {
    db.done(function(db) {
      db.collection('events').deleteOne({_id:req.id}, function(err) {
        res.json(err?err:{ok:true});
      });
    });
  });

module.exports = api;

