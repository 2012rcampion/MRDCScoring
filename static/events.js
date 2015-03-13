$(document).ready(function() {
  $('.team-edit').hide();
  $('.team-name').click(function() {
    $(this).parent().find('.team-edit').slideToggle();
  });
  
  /*$('#games-list').sortable({
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
  });*/
  
  $('#event-name').change(function() {
    var event = JSON.parse($(this).find('option:selected').attr('prototype'));
    console.log(event);
    $('#event-type').val(event.type);
    $('#event-value').val(event.value);
  }).change();
  
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
