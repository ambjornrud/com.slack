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

	/*
		Authorization
	*/
	_initAuth() {
		let auth = this._getAuth();
		if( auth && auth.access_token ) {
			this._slack.setAccessToken( auth.access_token );
		} else {
			this._setAuth();
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
					icon_url	: 'https://etc.athom.com/logo/white/1024.png'
				});
			})
			.getArgument('recipient')
			.registerAutocompleteListener(this._onFlowRecipientAutocomplete.bind(this));

		new Homey.FlowCardAction('send_image')
			.register()
			.registerRunListener( args => {

				if( !this._slack.isAuthorized() )
					throw new Error( Homey.__('unauthorized') );

				let image = args.droptoken;
				return image.getBuffer()
					.then( buf => {
						return this._slack.postImage(buf, args.message, [args.recipient.id]);
					})


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
		}).slice(0,50);
	}

}

module.exports = SlackApp;