'use strict';

const querystring = require('querystring');

const Homey = require('homey');
const axios = require('axios');

const CLIENT_ID = Homey.env.CLIENT_ID;
const CLIENT_SECRET = Homey.env.CLIENT_SECRET;
const SCOPES = [ 'chat:write:bot', 'channels:read' , 'users:read' ];
const API_URL = 'https://slack.com/api';
const OAUTH_URL = 'https://slack.com/oauth/authorize';

class Slack {
	
	setAccessToken( accessToken ) {
		this._accessToken = accessToken;		
	}
	
	isAuthorized() {
		return ( typeof this._accessToken === 'string' );
	}
	
	/*
		Api
	*/
	
	_call( path, data ) {
		
		let params = Object.assign(data || {}, {
			token: this._accessToken			
		});
		let qs = querystring.stringify(params);
				
		return axios({
			method: 'get',
			url: `${API_URL}${path}?${qs}`
		}).then( result => {
			let data = result.data;
			if( data.ok === false ) throw new Error( data.error );
			return result.data;
		})
	}
	
	/*
	_get( path ) {
		return this._call('get', path);
	}
	
	_post( path, data ) {
		return this._call('post', path, data);
	}
	
	_put( path, data ) {
		return this._call('put', path, data);
	}
	
	_delete( path ) {
		return this._call('delete', path);
	}
	*/
	
	/*
		Public Api methods
	*/	
	getChannels() {
		return this._call('/channels.list')
			.then(result => result.channels);
	}
	
	getUsers() {
		return this._call('/users.list')
			.then(result => result.members);
	}
	
	postMessage(data) {
		return this._call('/chat.postMessage', data)
			.then( result => {
				delete result.ok;
				return result;
			})
	}
	
	getToken(code) {
		return this._call('/oauth.access', {
			client_id: CLIENT_ID,
			client_secret: CLIENT_SECRET,
			code: code
		})
			.then( result => {
				delete result.ok;
				return result;
			})
	}
	
	static getOAuth2Url() {
		let qs = querystring.stringify({
			client_id: CLIENT_ID,
			scope: SCOPES.join(',')
		})
		return `${OAUTH_URL}?${qs}`;
	}
	
}

module.exports = Slack;