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

/* Connect to the Mongo database at the URI using the client */
module.exports = Promise.denodeify(mongodb.MongoClient.connect)(uri);


/*
  .then(function(db) {
    db.promise = function(collection, operation) {
        var args = Array.prototype.slice.call(arguments);
        args.shift().shift();
        return new Promise(function(resolve, reject) {
          args.push(function(err, result) {
              if(err) {
                return reject(Error(err));
              }
              resolve(result);
            });
          db.collection(collection)[operation].apply(null, args);
        });
      }
    return db;
  });*/

