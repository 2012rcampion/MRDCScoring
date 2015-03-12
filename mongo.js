var Promise = require('promise');
var mongodb = require('mongodb');
//var client = mongodb.MongoClient;

/*// database is unsecured for now
var auth = {
    user: 'username',
    pass: 'password',
    host: 'hostname',
    port: 1337,
    name: 'databaseName'
};
*/

//var uri = util.format('mongodb://%s:%s@%s:%d/%s',
//    auth.user, auth.pass, auth.host, auth.port, auth.name);
var uri = 'mongodb://localhost/jsdc';

// expose objectid to the app
module.exports.ObjectId = mongodb.ObjectId;

/* Connect to the Mongo database at the URI using the client */

var db;

module.exports = Promise.denodeify(mongodb.MongoClient.connect)(uri)
  .then(function(fulfill) {
    console.log('Connected to server at %s', uri);
    
    this.db = db;
    
    this.teams   = db.collection('teams');
    this.games   = db.collection('games');
    this.events  = db.collection('events');
    this.globals = db.collection('globals');
    
    callback();
  });    
};
