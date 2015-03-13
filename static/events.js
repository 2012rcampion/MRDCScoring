$(document).ready(function() {
  $('.event-full').hide();
  $('.event, .event-full').click(function() {
    $(this).parent().find('.event-full').slideToggle();
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
  
  if(localStorage.getItem('submitter')) {
    $('#submitter-field').val(localStorage.getItem('submitter'))
  }
  
  if(localStorage.getItem('team')) {
    $('#team-select').val(localStorage.getItem('team'))
  }
  
  
  $('#event-name').change(function() {
    var event = JSON.parse($(this).find('option:selected').attr('prototype'));
    console.log(event);
    $('#event-type').val(event.type);
    $('#event-value').val(event.value);
  }).change();
  
  $('#team-select').change(function() {
    var val = $('#team-select').val();
    $('input.team').val(val);
    localStorage.setItem('team', val);
  }).change();
  
  $('#submitter-field').change(function() {
    var val = $('#submitter-field').val();
    $('input.submitter').val(val);
    localStorage.setItem('submitter', val);
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
