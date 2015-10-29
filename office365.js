var fs = require('fs');
var jws = require('jws');
var uuid = require('node-uuid');
var outlook = require("node-outlook");
var simpleOAuth2 = require('simple-oauth2');
var MsDeferred = outlook.Microsoft.Utility.Deferred;
var promised = require('promised-io/promise');

var configDefaults = {
    tokenTTL: 15 // minutes
};


function Office365Config(configuration) {

    var self = this;
    ['tenantID', 'clientID', 'certThumbprint', 'tokenTTL', 'mailbox'].forEach(function (key) {
        var value = configuration[key];
        if (value === undefined) {
            value = configDefaults[key];
        }
        if (value === undefined) {
            throw 'Required parameter is not found: ' + key;
        }
        self[key] = value;
    });

    self.site = 'https://login.microsoftonline.com/' + self.tenantID;
    self.tokenPath = "/oauth2/token";
    self.useBasicAuthorizationHeader = false;
    self.clientSecretParameterName = 'client_assertion';

    var d = new Date();
    d.setFullYear(d.getFullYear() + 1000);

    self.clientSecret = jws.sign({
        header: {
            alg: 'RS256',
            x5t: self.certThumbprint
        },
        payload: {
            aud: self.site + self.tokenPath,
            iss: self.clientID,
            jti: uuid.v4(),
            sub: self.clientID,
            exp: d.getTime() / 1000
        },
        secret: configuration.key || process.env[configuration.keyEnv || 'MS_AZURE_SECRET'] || fs.readFileSync(configuration.keyFile, { encoding: 'ascii' }),
    });
}

var resource = 'https://outlook.office.com';

function createOAuth2(config) {
    if (!(config instanceof Office365Config)) {
        config = new Office365Config(config);
    }
    var oauth2 = simpleOAuth2(config);
    oauth2.createToken = createToken;
    return oauth2;
}

var createToken = (function () {
    var params = {
        grant_type: 'client_credentials',
        resource: resource,
        client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    };
    return function () {
        var deferred = new MsDeferred();
        this.client.getToken(params, function (error, result) {
            if (error) {
                console.error('Access Token Error: ', error);
                deferred.reject(error);
            } else {
                result.expires_in = +result.expires_in - 10;
                result.expires_on = +result.expires_on;
                result.not_before = +result.not_before;
                deferred.resolve(result);
            }
        });
        return deferred;
    };
})();

function createOutlookTokenFactory(config) {

    if (!(config instanceof Office365Config)) {
        config = new Office365Config(config);
    }
    var oauth2 = createOAuth2(config);

    return promised.seq([
        function () {
            return oauth2.createToken();
        },
        function (token) {
            token = oauth2.accessToken.create(token);
            return function getToken() {
                return promised.seq([
                    function () {
                        if (token.expired()) {
                            return oauth2.createToken();
                        }
                    },
                    function (newToken) {
                        if (newToken) {
                            token = oauth2.accessToken.create(newToken);
                            console.log('Updated token: ', token);
                        }
                        return token.token.access_token;
                    }
                ]);
            };
        }
    ]);
}

function createOutlookClient(config) {
    var deferredResult = new MsDeferred();
    promised.seq([
        function () {
            return createOutlookTokenFactory(config);
        },
        function (getToken) {
            var client = new outlook.Microsoft.OutlookServices.Client(resource + '/api/beta', getToken);
            deferredResult.resolve(client.users.getUser(config.mailbox), config);
        }
    ]);
    return deferredResult;
}

function logMsError(error) {
    console.error('Error:', error);
    if (typeof error.getAllResponseHeaders === 'function') {
        console.error('Error headers:', error.getAllResponseHeaders());
    }
};



exports.logMsError = logMsError;
exports.createOutlookClient = createOutlookClient;
exports.createOutlookTokenFactory = createOutlookTokenFactory;

exports.getODataType = function (object) {
    return object['@odata.type'];
};


var ETAG_REGEX = /^\s*(W\/)?\s*"(\w+)"\s*$/;

function getODataEtag (object, asObject) {
    var result = object['@odata.etag'];
    if(result && asObject) {
        result = new ETag(result);
    } 
    return result;
}

exports.getODataEtag = getODataEtag;

function ETag(str) {
    var parts = str.match(ETAG_REGEX);
    if (!parts) {
        throw new TypeError('Not an ETag: ' + str);
    }
    this.weak = Boolean(parts[1]);
    this.tag = parts[2];
}


ETag.prototype.toString = function () {
    return (this.weak ? 'W/' : '') + '"' + this.tag + '"';
};

exports.ETag = ETag;

