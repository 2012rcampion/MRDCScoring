var Promise = require('promise');
var db = require('./mongo.js');

var cache = {};

module.exports.get = function(name) {
  if(name in cache) {
    return Promise.resolve(cache[name]);
  }
  return db.then(function(db) {
    return new Promise(function(resolve, reject) {
      db.collection('globals').findOne({'name':name}, function(err, doc) {
        if(err) {
          reject(Error(err));
          return;
        }
        if(doc != null && 'val' in doc) {
          cache[name] = doc.val;
          resolve(doc.val);
          return;
        }
        reject(Error('global property '+name+' has no value'));
      });
    });
  });
}
  
module.exports.set = function(name, val) {
  cache[name] = val;
  db.then(function(db) {
    db.collection('globals').updateOne(
      {'name':name},
      {$set:{'val':val}},
      {upsert:true},
      function(err) {
        if(err) {
          console.log('error saving global property "%s": %j', name, err);
        }
    });
  });
}
