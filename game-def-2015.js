util = require('util');
extend = require('extend');

// game configuration

module.exports.name = 'JSDC 2015'; // name shown in menu

module.exports.duration = 5*60; // standard game duration, seconds

module.exports.countdown = true; // football style timer, not futbol style timer
module.exports.events = [ // possible game event types
  {name:'Basket',  type:'many',       value: 10},
  {name:'Ramp',    type:'onetime',    value: 30},
  {name:'Penalty', type:'many',       value:-50},
  {name:'Flying',  type:'multiplier', value:  2}
];

// set up initial state for all teams
module.exports.initState = function(teams) {
  var state = {};
  state.teams = teams; // so we know the order later
  teams.forEach(function(team) {
    state[team] = {
      baseScore:0, // current score without multiplier
      multiplier:1, // current multiplier
      score:0, // score with multiplier (required for end scoring)
      onetime:[] // which onetime events have they triggered
    };
  });
  console.log('initState:')
  console.log(state)
  return state;
}

// update game state
module.exports.updateState = function(state, event) {
  console.log('updateState:')
  console.log(state)
  console.log(event)
  state = extend(true, {}, state);
  console.log('copy of state:')
  console.log(state);
  var teamState = state[event.team];
  if(event.type == 'multiplier') {
    teamState.multiplier = event.value;
  }
  if(event.type == 'many') {
    teamState.baseScore += event.value;
  }
  if(event.type == 'onetime') {
    if(teamState.onetime.indexOf(event.name) == -1) {
      teamState.onetime.push(event.name);
      teamState.baseScore += event.value;
    }
  }
  teamState.score = teamState.multiplier * teamState.baseScore;
  return state;
}

// so far the render functions only produce strings, meaning you can only
// produce events listed in the `events` list.  Later they'll produce
// an object that gets rendered by jade during an api call.
// render game state, return as a list of strings for each team
module.exports.renderState = function(state) {
  return state.teams.map(function(team) {
    return util.format('%d pts', state[team].score);
  });
}

// render controls for events
module.exports.renderControl = function(event) {
  if(event.type == 'multiplier') {
    return util.format('%s (%dx multiplier)', event.name, event.value);
  }
  if(event.type == 'many') {
    return util.format('%s (%d points)', event.name, event.value);
  }
  if(event.type == 'onetime') {
    return util.format('%s (%d points)', event.name, event.value);
  }
  console.log('could not render control for event', event);
  console.log('not a recognized type');
  return JSON.stringify(event);
}
