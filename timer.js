var realtime = Date.now();

var gametime = 0;

var running = false;

var limit = 0;

module.exports.running = function() { return running; }

module.exports.set = function(seconds) {
  gametime = 1000*seconds;
}

module.exports.limit = function(seconds) {
  limit = 1000*seconds;
}

module.exports.start = function() {
  if(!running) {
    running = true;
    realtime = Date.now();
  }
}

module.exports.stop = function() {
  if(running) {
    running = false;
    var now = Date.now();
    gametime += now - realtime;
    realtime = now;
    if(gametime > limit) {
      gametime = limit;
    }
  }
}


module.exports.get = function(countdown) {
  var current = gametime;
  if(running) {
    current += Date.now() - realtime;
  }
  if(current > limit) {
    current = limit;
    module.exports.stop();
  }
  if(countdown) {
    current = limit - current;
  }
  return current/1000;
}
