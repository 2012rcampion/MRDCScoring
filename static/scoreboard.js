$(document).ready(function() {
  $.getJSON('/api/teams', function(teams) {
    var teamsList = $('#teamsList');
    teamsList.sortable();
    teams.forEach(function(team) {
      var li = $('<li>');
      li.html(team.name);
      teamsList.append(li);
    });
  });
});
