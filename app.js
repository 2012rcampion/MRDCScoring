var path = require('path');
var express = require('express');
var app = express();

var view_names = ['scoreboard', 'admin', 'jade_test'];

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(function(req, res, next) {
	console.log(new Date().toISOString(), ':', req.url);
	next();
});

app.get('/', function(req, res){
	res.redirect('/scoreboard');
});

view_names.forEach(function(view) {
	app.get('/'.concat(view), function (req, res) {
		res.render(view, { title: view, message: 'Hello there!'});
	});
});

app.get('*', function(req, res) {
	res.status(404).send('not found');
});

var server = app.listen(80, function() {
	console.log('Listening on port %d', server.address().port);
});

// exit gracefully on ctrl-c
process.on('SIGINT', function() {
	console.log('\nShutting down...');
	server.close(function() {
		console.log('Closed all connections, exiting now');
		process.exit()
	});
	
	// if after 
	setTimeout(function() {
		console.error('Closing connections timed out, exiting anyway');
		process.exit()
	}, 1000);
});