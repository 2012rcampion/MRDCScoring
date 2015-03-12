express = require('express');
mongo = require('mongodb');
db = require('./mongo.js');

module.exports = function(db, global, gameDef) {

  var api = express.Router();

  // log request body
  api.use(function(req, res, next) {
    console.log('req.body =', req.body);
    next();
  });

  // convert every instance of the id paramater to dbdb id format
  api.param('id', function(req, res, next, id){
    req.id = mongo.ObjectID(id);
    next();
  });

  api.param('team', function(req, res, next, id){
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
    })
    .put(function(req, res) {
      var team = req.body;
      db.done(function(db) {
db.collection('teams').updateOne({_id:req.id}, {$set:team}, function(err, doc) {
        res.json(err?err:doc);
      });
    })
    .delete(function(req, res) {
      db.done(function(db) {
db.collection('teams').deleteOne({_id:req.id}, function(err) {
        res.json(err?err:{ok:true});
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
db.games.find().toArray(function(err, docs) {
        res.json(docs);
      });
    })
    .post(function(req, res) {
      var game = req.body;
      db.done(function(db) {
db.games.insertOne(game, function(err, doc) {
        res.json(err?err:doc);
      });
    });
  api.route('/games/:id')
    .get(function(req, res) {
      db.done(function(db) {
db.games.findOne({_id:req.id}, function(err, doc) {
        res.json(err?err:doc);
      });
    })
    .put(function(req, res) {
      var game = req.body;
      db.done(function(db) {
db.games.updateOne({_id:req.id}, {$set:game}, function(err, doc) {
        res.json(err?err:doc);
      });
    })
    .delete(function(req, res) {
      db.done(function(db) {
db.games.deleteOne({_id:req.id}, function(err) {
        res.json(err?err:{ok:true});
      });
    });
  api.route('/games/:id/teams')
    .get(function(req, res) {
      db.done(function(db) {
db.games.findOne({_id:req.id}, function(err, doc) {
        res.json(err?err:(doc.teams));
      });
    }).post(function(req, res) {
      if(!req.body.team) {
        res.json({ok:false, reason:"No team specified!"});
        return;
      }
      db.done(function(db) {
db.games.updateOne({_id:req.id}, {$addToSet:{teams:req.body.team}}, function(err, doc) {
        res.json(err?err:doc);
      });
    });
  api.route('/games/:id/teams/:team')
    .delete(function(req, res) {
      db.done(function(db) {
db.games.updateOne({_id:req.id}, {$pull:{teams:req.body.teamID}}, function(err) {
        res.json(err?err:{ok:true});
      });
    });

  // define api for events

  function updateEventsFrom(eventID) {
    globals.get('game-current', function(currentID) {
      //db.events.findOne({'game':db.ObjectId(currentID))
      
    });
  }
  

  api.route('/events')
    .get(function(req, res) {
      db.done(function(db) {
db.events.find().toArray(function(err, docs) {
        res.json(docs);
      });
    })
    .post(function(req, res) {
      var event = req.body;
      
      async.parallel([
          function(callback) {
            if(!('game' in event)) {
              getGlobal('game-current', function(current) {
                event.game = current;
                callback();
              });
            }
            else {
              callback();
            }
          },
          function(callback) {
            getTimecallback();
          }
        ],
        function(err, res) {
          db.done(function(db) {
db.events.insertOne(event, function(err, doc) {
            res.json(err?err:doc);
          });
        }
      );
    });
  api.route('/events/:id')
    .get(function(req, res) {
      db.done(function(db) {
db.events.findOne({_id:req.id}, function(err, doc) {
        res.json(err?err:doc);
      });
    })
    .put(function(req, res) {
      var event = req.body;
      db.done(function(db) {
db.events.updateOne({_id:req.id}, {$set:event}, function(err, doc) {
        res.json(err?err:doc);
      });
    })
    .delete(function(req, res) {
      db.done(function(db) {
db.events.deleteOne({_id:req.id}, function(err) {
        res.json(err?err:{ok:true});
      });
    });

  return api;

}
