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

var resource = 'https://outlook.office365.com';

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
                        token = newToken || token;
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
            var client = new outlook.Microsoft.OutlookServices.Client(resource + '/api/v1.0', getToken);
            deferredResult.resolve(config.mailbox ? client.users.getUser(config.mailbox) : client, config);
        }
    ]);
    return deferredResult;
}

exports.createOutlookClient = createOutlookClient;
exports.createOutlookTokenFactory = createOutlookTokenFactory;