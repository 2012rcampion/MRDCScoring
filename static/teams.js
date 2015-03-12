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
