"use strict";

const Homey = require('homey');
const Slack = require('./lib/Slack.js');

const POLL_INTERVAL = 1000 * 60 * 60; // 1h

class SlackApp extends Homey.App {
	
	onInit() {
		
		this._users = [];
		this._channels = [];
			
		this._slack = new Slack();
		
		this._initAuth();
		this._initFlow();
		
		this._refresh();
		this._refreshInterval = setInterval(this._refresh.bind(this), POLL_INTERVAL);
	}
	
	_refresh() {
		
		if( !this._slack.isAuthorized() ) return;
		
		let channels = this._slack.getChannels()
			.then( channels => this._channels = channels );
			
		let users = this._slack.getUsers()
			.then( users => this._users = users );
			
		return Promise.all([ channels, users ])
			.catch( this.error );
	}
	
	_initAuth() {
		let auth = this._getAuth();
		if( typeof auth === 'undefined' ) {
			this._setAuth();
		} else {
			this._slack.setAccessToken( auth.access_token );			
		}		
	}
	
	_getAuth() {
		return Homey.ManagerSettings.get('auth');
	}
	
	_setAuth( access_token, team_name, team_id ) {
		Homey.ManagerSettings.set('auth', {
		    access_token: access_token,
		    team_name: team_name,
		    team_id: team_id
		});
		
		this._slack.setAccessToken( access_token );
		
		this._users = [];
		this._channels = [];
		
		this._refresh();
		
	}
	
	authorize() {
		return new Promise((resolve, reject) => {
			
			let url = Slack.getOAuth2Url();
			new Homey.CloudOAuth2Callback(url)
				.on('url', resolve)
				.on('code', code => {
					this._slack.getToken(code)
						.then( result => {
							this._setAuth(result.access_token, result.team_name, result.team_id);
							Homey.ManagerApi.realtime('authorized', true);
						})
						.catch(err => {
							this.error(err);
							Homey.ManagerApi.realtime('authorized', false);
						})
				})
				.generate()
				.catch(err => {
					this.error(err);
					reject(err);
				})
				
			
		});
	}
	
	/*
		Flow
	*/
	_initFlow() {
		
		new Homey.FlowCardAction('send_message')
			.register()
			.registerRunListener( args => {
		
				if( !this._slack.isAuthorized() )
					throw new Error( Homey.__('unauthorized') );
				
				return this._slack.postMessage({
					text		: args.message,
					channel		: args.recipient.id,
					username	: 'Homey',
					icon_url	: 'https://homey-static.athom.com/apps/com.slack/icon.png'					
				});
			})
			.getArgument('recipient')
			.registerAutocompleteListener(this._onFlowRecipientAutocomplete.bind(this));
		
	}
	
	_onFlowRecipientAutocomplete( query ) {
		
		if( !this._slack.isAuthorized() )
			return Promise.reject( new Error( Homey.__('unauthorized') ) );
			
		let result = [];
		
		this._channels.forEach(channel => {
			if( channel.is_archived ) return;
			result.push({
				id: channel.id,
				name: '#' + channel.name
			});
		});
		
		this._users.forEach(user => {
			if( user.deleted ) return;
			result.push({
				id: user.id,
				name: user.profile.real_name + ' (@' + user.name + ')',
				image: user.profile.image_72				
			});
		})
			
		return result.filter(recipient => {
			return recipient.name.toLowerCase().indexOf(query.toLowerCase()) > -1;			
		});
	}
	
}

module.exports = SlackApp;

return;

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