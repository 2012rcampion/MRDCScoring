var express = require('express');
var app = express();

app.set('views', './views');
app.set('view engine', 'jade');

app.get('/', function(req, res){
	res.send('Hello World!');
});

app.get('/jade_test', function (req, res) {
	res.render('jade_test', { title: 'Hey', message: 'Hello there!'});
})

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