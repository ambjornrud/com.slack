'use strict';

const querystring = require('querystring');

const Homey = require('homey');
const axios = require('axios');
const FormData = require('form-data');

const CLIENT_ID = Homey.env.CLIENT_ID;
const CLIENT_SECRET = Homey.env.CLIENT_SECRET;
const SCOPES = [ 'chat:write:bot', 'channels:read' , 'users:read', 'files:write:user' ];
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
	
	_call( method, path, params, opts ) {
		
		params = Object.assign({}, params || {}, {
			token: this._accessToken			
		});
		let qs = querystring.stringify(params);
		opts = Object.assign({
			method: method,
			baseURL: API_URL,
			url: `${path}?${qs}`
		}, opts);
								
		return axios(opts)
			.then( result => {
				let data = result.data;
				if( data.ok === false ) throw new Error( data.error );
				return result.data;
			})
	}
	
	_get( path, params, opts ) {
		return this._call('get', path, params, opts);
	}
	
	_post( path, params, opts ) {
		return this._call('post', path, params, opts);
	}
	
	_put( path, params, opts ) {
		return this._call('put', path, params, opts);
	}
	
	_delete( path, params, opts ) {
		return this._call('delete', path, params, opts);
	}
	
	/*
		Public Api methods
	*/	
	getChannels() {
		return this._get('/conversations.list')
			.then(result => result.channels);
	}
	
	getUsers() {
		return this._get('/users.list')
			.then(result => result.members);
	}
	
	postMessage(params) {
		return this._get('/chat.postMessage', params)
			.then( result => {
				delete result.ok;
				return result;
			})
	}
	
	postImage(buf, name, channels) {
		
		const form = new FormData();
		form.append('file', buf, {
			contentType: 'image/jpeg',
			filename: name
		});
		
		return this._post('/files.upload', {
			channels: channels.join(',')
		}, {
			data: form,
			headers: form.getHeaders()
		})
			.then( result => {
				return result.file;
			});
	}
	
	getToken(code) {
		return this._post('/oauth.access', {
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