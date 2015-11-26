module.exports = [
    
    {
        description:	'Log-in',
        method: 		'POST',
        path:			'/settings/authorize',
        fn: function( callback, args ){
            Homey.app.authorize( callback );
        }
    }
    
]