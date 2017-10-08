'use strict';

const Homey = require('homey');

module.exports = [
    
    {
        description:	'Log-in',
        method: 		'POST',
        path:			'/settings/authorize',
        fn: function( args ){
	        return Homey.app.authorize();
        }
    }
    
]