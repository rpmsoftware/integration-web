var webhooks = require('./webhooks');
var rpmUtil = require('integration-common/util');
var config = rpmUtil.readConfig(undefined, 'config.json').webHook;
var cpath = 'https://localhost:' + config.port + '/' + config.path;
var RESTClient = require('node-rest-client').Client;

var server = webhooks.start(config,
    function (request) {
        console.log('Server recieved: ', request);
    });

function send(headers, data) {
    new RESTClient().post(cpath, { headers: headers, data: data }, function (data, response) {
        server.close();
    });
}

var data = new webhooks.WebHooksRequestData(100, 12, 'form.start');
send(new webhooks.WebHooksRequestHeader(33, 100, data, config.signSecret), data);
