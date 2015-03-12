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

/* Connect to the Mongo database at the URI using the client */
module.exports = Promise.denodeify(mongodb.MongoClient.connect)(uri)
  .then(Promise.denodify(db.collections))
  .then(function(collections) {
    var map = {ObjectId:mongodb.ObjectId};
    collections.forEach(function(collection) {
      map[collection.collectionName] = collection
    });
    return map;
  });

