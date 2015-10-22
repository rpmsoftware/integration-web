/* global process */
var express = require('express');
var bodyParser = require('body-parser');
var https = require('https');
var rpmUtil = require('integration-common/util');

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

function startPostServer(port, path, options, callback) {
    if (arguments.length < 3) {
        callback = path;
        options = port;
        port = options.port;
        path = options.path;
    }
    var app = express();
    var heroku = rpmUtil.isHeroku();
    if (heroku) {
        app.use(herokuEnsureHttps);
        port = process.env.PORT;
    }
    app.use(bodyParser.text({ type: '*/*' }));
    app.post(normalizePath(path), callback);
    var srv;
    if (!heroku) {
        app = https.createServer(options, app);
    }
    srv = app.listen(port);
    console.info('WebHooks server is listening on port', port);
    return srv;
};

exports.startPostServer = startPostServer;

