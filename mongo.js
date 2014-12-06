//var util = require('util');
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

/* Connect to the Mongo database at the URI using the client */
module.exports.init = function(callback) {
  mongodb.MongoClient.connect(uri, function(err, db) {
    if(err) {
      throw err;
    }
    console.log('Connected to server at %s', uri);

    module.exports.db = db;
    callback();
  });    
};
