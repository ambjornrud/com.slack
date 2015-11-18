"use strict";

var Slack 	= require('slack-node');
var request = require('request');
var slack;

var recipients = [];

var self = module.exports = {
	
	init: function() {
		
		Homey.log("Slack for Homey is ready!", Homey.env);
		
		slack = new Slack('xoxp-2562297411-2562297413-14868979744-d38b35c2bf');
		
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
		
		Homey.manager('flow').on('action.send_message', function( callback, args ){
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
		
	}
}

function authorize( callback ) {
	
	callback = callback || function(){}
	
	Homey.manager('cloud').generateOAuth2Callback(
		'https://slack.com/oauth/authorize?client_id=' + Homey.env.CLIENT_ID + '&scope=chat:write:bot,channels:read,users:read',
		onGotUrl,
		onGotCode
	);
	
	function onGotUrl( err, url ){
		if( err ) return callback(err);
		Homey.log('Got url!', url);
		// send the url to the front-end, e.g. with emit() during pairing
	}
	
	function onGotCode( err, code ) {
		if( err ) return callback(err);
		
		Homey.log('Got authorization code!', code);
		
		// swap the authorization code for a token					
		request.post( 'https://slack.com/api/oauth.access', {
		    form: {
		        'client_id'		: Homey.env.CLIENT_ID,
		        'client_secret'	: Homey.env.CLIENT_SECRET,
		        'code'			: code
		    },
		    json: true
		}, function( err, response, body ){
		    if( err || body.error ) return callback( err || body.error );
		    callback( null, body )
		});
	}
}


/*
  body { ok: true,
  access_token: '**CENSOR**',
  scope: 'identify,chat:write:bot',
  team_name: 'Athom BV',
  team_id: 'T02GJ8RC3' }
*/