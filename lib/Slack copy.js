"use strict";

var https		= require('https');
var querystring = require('querystring');

function Slack( token ) {
	this.token = token;	
}

Slack.prototype.api = function( method, args, callback ) {
	
	callback = callback || function(){}
	args = args || {};
	args.token = this.token;
	
	var url = 'https://slack.com/api/' + method + '?' + querystring.stringify(args);
		
	https
		.get(url, function(res) {
			var body = "";
			res
				.on('data', function(chunk) {
					body += chunk;
				}).on('end', function(){					
					try {
						body = JSON.parse(body);
						callback( null, body );
					} catch(e){
						callback( e, null );
					}
				})
			
		})
		.on('error', function(e) {
			callback( e, null );
		})
}

module.exports = Slack;