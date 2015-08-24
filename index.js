
var webhooks = require('./webhooks');

var port= 30000;
var path =  'some/path';
var cpath = 'http://localhost:' + port+'/'+path;

var server = webhooks.start(port, path, function(some) {
    console.log('some: ', some);
}); 
var RESTClient = require('node-rest-client').Client;

send(new webhooks.WebHooksRequestHeader('telco','sda'), new webhooks.WebHooksRequestData(100, 12, 'form.start'));


function send(headers, data) {
    new RESTClient().post(cpath, {headers:headers, data:data}, function (data, response) {
        server.close(); 
    });
    
}

