var Promise = require('promise');
var db = require('./mongo.js');

var cache = {};

module.exports.get = function(name) {
    if(name in cache) {
      return Promise.resolve(cache[name]);
    }
    return Promise.denodeify(db.globals.findOne)({'name':name}_
      .then(function(doc) {
        else if(doc != null && 'val' in doc) {
          cache[name] = doc.val;
          callback(doc.val);
        }
        else {
          console.log('warning getting global property "%s": has no value', name, err);
          callback(null);
        }
      });
    }
  };
  
  globals.set = function(name, val) {
    cache[name] = val;
    db.cache.updateOne({'name':name}, {$set:{'val':val}}, {upsert:true},
      function(err, res) {
        if(err) {
          console.log('error setting global property "%s": %j', name, err);
        }
      }
    );
  };
  
  return globals

}
  
