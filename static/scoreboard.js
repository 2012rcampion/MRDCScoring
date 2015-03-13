function set(time) {
  time = Math.floor(time);
  $('#time').html(Math.floor(time/60) + ':' + (time%60 < 10?'0':'') + (time%60));
}

function update() {
  var relative = Date.now() - realtime;
  var now = gametime;
  if(countdown) {
    now -= relative/1000;
  }
  if(now < 0) {
    now = 0;
    countdown = false;
  }
  set(now);
  if(countdown) {
    setTimeout(update, 100);
  }
}

$(document).ready(function() {
  setTimeout(function() {
    location.reload(true);
  }, 5000);
  
  update()
  
});
