
var webhooks = require('./webhooks');

var rpmUtil = require('integration-common/util');

var config = rpmUtil.readConfig(undefined, 'config.json');

var cpath = 'https://localhost:' + config.port + '/' + config.path;

// fs.writeFileSync('ccc.json',JSON.stringify(config),'ascii');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

var server = webhooks.start(config.port, config.path, config,
    function (request) {
        console.log('Server recieved: ', request);
    });


var RESTClient = require('node-rest-client').Client;

send(new webhooks.WebHooksRequestHeader('telco', 100), new webhooks.WebHooksRequestData(100, 12, 'form.start'));


function send(headers, data) {
    new RESTClient().post(cpath, { headers: headers, data: data }, function (data, response) {
        server.close();
    });

}

