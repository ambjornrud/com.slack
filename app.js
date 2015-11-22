"use strict";

var https		= require('https');
var querystring = require('querystring');

var Slack 		= require('./lib/Slack.js');

var slack;
var recipients = [];

var self = module.exports = {
	
	init: function() {
				
		Homey.log("Slack for Homey is ready!");
		
		initSlack();
		
		Homey.manager('flow').on('action.send_message', function( callback, args ){			
			
			if( typeof slack == 'undefined' ) return callback( new Error("slack not inited") );
			
			slack.api('chat.postMessage', {
				text		: args.message, 
				channel		: args.recipient.id,
				username	: 'Homey'
			}, function(err, response){
				callback( err instanceof Error );
			});
		})
		
		Homey.manager('flow').on('action.send_message.recipient.autocomplete', function( callback, query ){			
			var results = recipients.filter(function(recipient){
				return recipient.name.toLowerCase().indexOf(query.toLowerCase()) > -1;
			})			
			callback( results );
		})
		
	},
	
	authorize: authorize
}

function initSlack() {		
	if( typeof Homey.settings.access_token == 'string' ) {
	
		// create the instance
		slack = new Slack( Homey.settings.access_token );
		
		// get channels & users for the flow editor		
		slack.api('channels.list', {}, function(err, response){
			if( Array.isArray(response.channels) ) {
				response.channels.forEach(function(channel){
					if( channel.is_archived ) return;
					recipients.push({
						id		: channel.id,
						name	: '#' + channel.name
					})
				})
			}
		});	
		
		slack.api('users.list', {}, function(err, response){
			if( Array.isArray(response.members) ) {
				response.members.forEach(function(member){
					if( member.deleted ) return;
					recipients.push({
						id		: member.id,
						name	: member.profile.real_name + ' (@' + member.name + ')',
						image	: member.profile.image_72
					})
				})
			}
		});
	
	}
}

function authorize( callback ) {
	
	callback = callback || function(){}
	
	var callback_called = false;
	
	Homey.manager('cloud').generateOAuth2Callback(
		'https://slack.com/oauth/authorize?client_id=' + Homey.env.CLIENT_ID + '&scope=chat:write:bot,channels:read,users:read',
		onGotUrl,
		onGotCode
	);
	
	function onGotUrl( err, url ){
		if( err ) return callback(err);
		Homey.log('Got url!', url);
		callback( null, url );
		callback_called = true;
	}
	
	function onGotCode( err, code ) {
		if( err ) return Homey.error(err);
		
		Homey.log('Got authorization code!', code);
		
		var data = querystring.stringify({
	        'client_id'		: Homey.env.CLIENT_ID,
	        'client_secret'	: Homey.env.CLIENT_SECRET,
	        'code'			: code
		});
		
		var options = {
			host: 'slack.com',
			path: '/api/oauth.access',
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				'Content-Length': Buffer.byteLength(data)
			}
		};
		
		var req = https.request(options, function(res) {
			res.setEncoding('utf8');
			var body = "";
			res.on('data', function (chunk) {
				body += chunk;
			});
			res.on('end', function(){
				try {
					body = JSON.parse(body);
					
				    if( body.ok !== true ) return Homey.error( "body not ok" );
				    
				    Homey.settings.access_token = body.access_token;
				    Homey.settings.team_name 	= body.team_name;
				    Homey.settings.team_id 		= body.team_id;
				    
					initSlack();
					
				} catch(e){
					Homey.error(e);
				}
			})
		});
		
		req.write(data);
		req.end();
	}
}