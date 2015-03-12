var valueMap = {};

module.exports = function(mongo) {
  
  var db = mongo;
  
  var globals = {};
  
  globals.get = function(name, callback) {
    if(name in valueMap) {
      callback(valueMap[name]);
    }
    else {
      db.valueMap.findOne({'name':name}, function(err, doc) {
        if(err) {
          console.log('error getting global property "%s": %j', name, err);
          callback(null);
        }
        else if(doc != null && 'val' in doc) {
          valueMap[name] = doc.val;
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
    valueMap[name] = val;
    db.valueMap.updateOne({'name':name}, {$set:{'val':val}}, {upsert:true},
      function(err, res) {
        if(err) {
          console.log('error setting global property "%s": %j', name, err);
        }
      }
    );
  };
  
  return globals

}
  
