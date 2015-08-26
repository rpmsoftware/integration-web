var fs = require('fs');
var jws = require('jws');
var uuid = require('node-uuid');
var outlook = require("node-outlook");
var simpleOAuth2 = require('simple-oauth2');

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
        secret: process.env[configuration.keyEnv || 'MS_AZURE_SECRET'] || fs.readFileSync(configuration.keyFile, { encoding: 'ascii' }),
    });
}

var resource = 'https://outlook.office365.com';

function createOutlookClient(config) {
    var deferredResult = new outlook.Microsoft.Utility.Deferred();

    if (!(config instanceof Office365Config)) {
        config = new Office365Config(config);
    }
    var oauth2 = simpleOAuth2(config);


    var createToken = (function () {
        var params = {
            grant_type: 'client_credentials',
            resource: resource,
            client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
        };
        return function (callback) {
            oauth2.client.getToken(params, function (error, result) {
                if (error) {
                    console.error('Access Token Error: ', error);
                } else {
                    result.expires_in = +result.expires_in - 10;
                    result.expires_on = +result.expires_on;
                    result.not_before = +result.not_before;
                }
                callback(error, result);
            });
        }
    })();

    createToken(function (error, result) {
        if (error) {
            deferredResult.reject(error);
            return;
        }
        var token = oauth2.accessToken.create(result);

        function getToken() {
            var deferred = new outlook.Microsoft.Utility.Deferred();
            if (token.expired()) {
                createToken(function (error, result) {
                    if (error) {
                        deferred.reject(error);
                    } else {
                        token = oauth2.accessToken.create(result);
                        deferred.resolve(token.token.access_token);
                    }
                });
            }
            else {
                deferred.resolve(token.token.access_token);
            }
            return deferred;
        }
        var client = new outlook.Microsoft.OutlookServices.Client(resource + '/api/v1.0', getToken);
        deferredResult.resolve(config.mailbox ? client.users.getUser(config.mailbox) : client, config);
    });
    return deferredResult;
}

exports.createOutlookClient = createOutlookClient;