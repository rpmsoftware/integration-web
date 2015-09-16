/* global process */
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

function herokuEnsureHttps(req, res, next) {
    if (req.headers['x-forwarded-proto'] === 'https') {
        return next();
    }
    res.status(404).send('https please');
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
    var srv;
    if (isHeroku()) {
        console.log('Heroku is found');
        app.use(herokuEnsureHttps);
        port = process.env.PORT;
    } else {
        console.log('Not Heroku environment');
        app = https.createServer(options, app);
    }
    srv = app.listen(port);
    console.info('WebHooks server is listening on port', port);
    return srv;
};

exports.startJsonPostServer = startJsonPostServer;

function isHeroku() {
    console.log('env:',process.env);
    for (var key in HEROKU_ENVIRONMENT) {
        var value = HEROKU_ENVIRONMENT[key];
        var env = process.env[key];
        if (!env || typeof value === 'string' && value !== env || value.test && !value.test(env)) {
            console.log(key,value,env);
            return false;
        }
    }
    return true;
}

var HEROKU_ENVIRONMENT = {
    DYNO: /^web\.\d+$/,
    PORT: /^\d+$/,
    NODE_HOME: '/app/.heroku/node',
    _: '/app/.heroku/node/bin/node'
};