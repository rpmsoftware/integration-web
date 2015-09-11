var express = require('express');
var bodyParser = require('body-parser');
var https = require('https');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

function normalizePath(path) {
    var slash = '/';
    if (path) {
        path = path.trim();
        if (path[0] !== slash) {
            path = slash + path;
        }
    } else {
        path = slash;
    }
    return path;
}

function startJsonPostServer(port, path, options, callback) {
    if (arguments.length < 3) {
        callback = path;
        options = port;
        port = options.port;
        path = options.path;
    }
    var app = express();
    app.use(bodyParser.json());
    app.post(normalizePath(path), callback);
    var srv = https.createServer(options, app).listen(port);
    console.info('WebHooks server is listening on port', port);
    return srv;
};

exports.startJsonPostServer = startJsonPostServer;