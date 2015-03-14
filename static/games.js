function enableSort() {
  $('#games-list').sortable({
    axis:'y',
    update: function(event, ui) {
      var data = $('#games-list')
        .find('.game-item')
        .not('.current')
        .map(function() {
          return this.id;
        }).toArray();
      console.log(data)
      $.ajax({
        data: {order:data},
        type: 'POST',
        url: '/api/games/order',
        success: function(res) {
          console.log('success!');
          location.reload(true); // reload page on success
        }
      });
    }
  });
}


$(document).ready(function() {
  $('.team-edit').hide();
  $('.team-name').click(function() {
    $(this).parent().find('.team-edit').slideToggle();
  });
  

  
  // custom form submission
  $('form').submit(function() {
    var form = $(this);
    var options = {
      url: form.attr('action'),
      type: form.attr('method'),
      data: form.serialize(),
      success: function(res) {
        console.log('success!');
        location.reload(true); // reload page on success
      }
    }
    console.log(options);
    $.ajax(options);    
    console.log('request sent, attempting to stop submission');
    return false; // stop form from submitting itself
  });
});
