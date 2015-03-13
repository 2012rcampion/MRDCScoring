var express = require('express');
var mongo = require('mongodb');

var db = require('./mongo.js');
var globals = require('./globals');
var gameDef = require('./game-def-2015.js');
var timer = require('./timer.js');

var api = express.Router();

// log request body
api.use(function(req, res, next) {
  console.log('req.body =', req.body);
  next();
});

// convert every instance of the id paramater to mongodb id format
api.param('id', function(req, res, next, id) {
  req.id = mongo.ObjectID(id);
  console.log('%s -> %j', id, req.id);
  console.log(req.id);
  console.log(mongo.ObjectID(id));
  next();
});

api.param('team', function(req, res, next, id) {
  req.teamId = mongo.ObjectID(id);
  console.log('%s -> %j', id, req.teamId);
  console.log(req.teamId);
  console.log(mongo.ObjectID(id));
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

function advanceOrder() {
  globals.get('game-current').done(function(current) {
    globals.get('game-order').done(function(order) {
      globals.set('game-current', order.shift());
      globals.set('game-order', order);
    });
  });
}

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
    if(!('teams' in game)) {
      game.teams = [];
    }
    db.done(function(db) {
      db.collection('games').insertOne(game, function(err, doc) {
        res.json(err?err:doc);
        if(err) {
          return;
        }
        globals.get('game-order').done(function(order) {
          console.log(doc)
          order.push(doc.ops[0]._id);
          globals.set('game-order', order);
        });
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
        res.json(err?err:res);
        if(err) {
          return;
        }
        globals.get('game-order').done(function(order) {
          order.forEach(function(id, i) {
            if(id.toHexString() == req.id.toHexString()) {
              order.splice(i, 1);
              globals.set('game-order', order);
            }
          });
          
          globals.get('game-current').done(function(current) {
            if(current && req.id.toHexString() == current.toHexString()) {
              advanceOrder();
            }
          });
        });
      });
    });
  });
api.route('/games/complete')
  .post(function(req, res) {
    globals.get('game-current').done(function(current) {
      if(!current) {
        res.json({'err':1, 'reason':'no current game'});
        return
      }
      db.done(function(db) {
        db.collection('games').update(
          {_id:current},
          {$currentDate:{completed:true}},
          function(err, doc) {
            res.json(err?err:doc);
            advanceOrder();
          });
      });      
    });
  });
api.route('/games/order')
  .post(function(req, res) {
    if(res.body.order && res.body.order.length > 0) {
      globals.set('order',res.body.order.map(function(id) {
        return mongo.ObjectID(id);
      }));
      return res.json({'ok':1});
    }
    res.json({'err':1, 'reason':"order parameter is not a non-empty array"});
  });
api.route('/games/:id/start')
  .post(function(req, res) {
    globals.get('game-current').done(function(current) {
      globals.get('game-order').done(function(order) {
        if(current) {
          globals.set('game-order', order.unshift(current));
        }
        globals.set('game-current', req.id);
        order.forEach(function(id, i) {
          if(id.toHexString() == req.id.toHexString()) {
            order.splice(i, 1);
            globals.set('game-order', order);
          }
        });
        res.json({'ok':1});
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
      db.collection('games').updateOne(
        {_id:req.id},
        {$addToSet:{teams:(mongo.ObjectID(req.body.team))}},
        function(err, doc) {
          res.json(err?err:doc);
          updateEventsFrom(req.id, -1);
        });
    });
    
  });
api.route('/games/:id/teams/:team')
  .delete(function(req, res) {
    db.done(function(db) {
      db.collection('games')
      .updateOne(
        {_id:req.id},
        {$pullAll:{teams:[req.teamId, req.teamId.toHexString()]}},
        function(err) {
          res.json(err?err:{ok:true});
          updateEventsFrom(req.id, -1);
        });
    });
  });

// define api for events

function updateEventsFrom(gameID, gameTime) {
  db.then(function(db) {
    db.collection('events')
    .findOne(
      {'game':mongo.ObjectID(gameID), clock:{$lt:gameTime}},
      {sort:[['clock', -1]]},
      function(err, first) {
        if(err) {
          console.log('error getting previous event:', err);
          return;
        }
        var startingState;
        if(first == null) {
          console.log('first == null');
          startingState = new Promise(function(resolve, reject) {
            console.log('resolving promise');
            db.collection('games').findOne(
              {'_id':mongo.ObjectID(gameID)},
              function(err, game) {
                if(err) {
                  reject(Error(err));
                  return;
                }
                if(game == null) {
                  reject(Error("game-current is invalid!"));
                  return;
                }
                var state = gameDef.initState(game.teams);
                console.log('resolving to', state);
                resolve(state);
              });
          });
          console.log(startingState);
        }
        else {
          console.log('else');
          startingState = Promise.resolve(first.state);
        }
        
        console.log(startingState);
        startingState.then(function(state) {
          db.collection('events')
            .find({
              game:mongo.ObjectID(gameID),
              clock:{$gte:gameTime}
            })
            .sort({'clock':1})
            .each(function(err, event) {
              if(err) {
                console.log('error getting event:', err);
                return;
              }
              if(event == null) {
                db.collection('games')
                  .updateOne(
                    {'_id':gameID},
                    {$set:{scores:(state.teams.map(function(team) {
                      return state[team].score;
                    }))}},
                    function(err, doc) {
                      if(err) {
                        console.log('error saving scores:', err)
                      }
                    });
                return;
              }
              state = gameDef.updateState(state, event);
              db.collection('events')
                .update(
                  {'_id':event._id},
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
    
    if(!('game' in event)) {
      return res.json({'err':1, 'reason':'event got no game!'});
    }
    
    event.game = mongo.ObjectID(event.game);
    event.team = mongo.ObjectID(event.team);
    
    event.submitted = new Date();
    event.clock     = timer.get();
    
    db.done(function(db) {
      db.collection('events').insertOne(event, function(err, doc) {
        res.json(err?err:doc);
        updateEventsFrom(event.game, event.clock);
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
              updateEventsFrom(updatedEvent.game, updatedEvent.clock);
            });
            
        });
    });
  })
  .delete(function(req, res) {
    db.done(function(db) {
      db.collection('events')
        .findOneAndDelete({_id:req.id}, {}, function(err, doc) {
          res.json(err?err:{'ok':1});
          updateEventsFrom(doc.value.game, doc.value.clock);
        });
    });
  });
  
api.route('/timer/stop').all(function(req, res) {
  timer.stop();
  res.end();
});

api.route('/timer/start').all(function(req, res) {
  timer.start();
  res.end();
});

api.route('/timer/reset').all(function(req, res) {
  timer.set(0);
  res.end();
});

module.exports = api;

