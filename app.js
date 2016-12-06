"use strict";

var https		= require('https');
var querystring = require('querystring');

var Slack 		= require('./lib/Slack.js');

var slack;
var recipients = false;

var self = module.exports = {

	init: function() {

		Homey.log("Slack for Homey is ready!");

		if( typeof Homey.manager('settings').get('auth') == 'undefined' ) {
			Homey.manager('settings').set('auth', {});
		}

		initSlack();
		setInterval(initSlack, 1000 * 60 * 60 * 6); // refresh every 6h

		/*
			Flow events
		*/
		Homey.manager('flow').on('action.send_message', function( callback, args ){

			if( typeof slack == 'undefined' ) return callback( new Error("slack not inited") );

			slack.api('chat.postMessage', {
				text		: args.message,
				channel		: args.recipient.id,
				username	: 'Homey',
				icon_url	: 'https://homey-static.athom.com/apps/com.slack/icon.png'
			}, function(err, response){
				if( err ) return callback(err);
				return callback( null, true );
			});
		})

		Homey.manager('flow').on('action.send_message.recipient.autocomplete', function( callback, args ){

			if( !Array.isArray(recipients) ) return callback( new Error("Not logged in") );

			var results = recipients.filter(function(recipient){
				return recipient.name.toLowerCase().indexOf(args.query.toLowerCase()) > -1;
			})
			callback( null, results );
		})

	},

	authorize: authorize
}

/*
	Initialize Slack API
*/
function initSlack() {
	var access_token = Homey.manager('settings').get('auth').access_token;
	if( typeof access_token == 'string' ) {

		// create the instance
		slack = new Slack( access_token );

		recipients = [];

		// get channels & users for the flow editor
		slack.api('channels.list', {}, function(err, response){
			if( err ) return console.error( err );

			if( response && Array.isArray(response.channels) ) {
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
			if( err ) return console.error( err );

			if( response && Array.isArray(response.members) ) {
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

/*
	Authorize with Slack
*/
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

		Homey.log('got url:', url);
		callback( null, url );
		callback_called = true;
	}

	function onGotCode( err, code ) {
		if( err ) {
		    Homey.manager('api').realtime('authorized', false);
			return Homey.error(err);
		}

		Homey.log('Got authorization code!');

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

				    if( body.ok !== true ) {
					    Homey.manager('api').realtime('authorized', false);
					    return Homey.error( "body not ok" );
					}

				    Homey.manager('settings').set('auth', {
					    access_token	: body.access_token,
					    team_name		: body.team_name,
					    team_id			: body.team_id
					});

				    Homey.manager('api').realtime('authorized', true);

					initSlack();

				} catch(e){
				    Homey.manager('api').realtime('authorized', false);
					Homey.error(e);
				}
			})
		});

		req.write(data);
		req.end();
	}
}