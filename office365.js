/* global process */
var fs = require('fs');
var jws = require('jws');
var uuid = require('node-uuid');
var outlook = require("node-outlook");
var logError = require('integration-common/util').logErrorStack;

var Microsoft = outlook.Microsoft;
var simpleOAuth2 = require('simple-oauth2');
var assert = require('assert');

function fixDates(data) {
    assert.strictEqual(typeof data, 'object');
    data.DateTimeCreated = data.CreatedDateTime;
    data.DateTimeLastModified = data.LastModifiedDateTime;
    if (Array.isArray(data.value)) {
        data.value.forEach(function (value) {
            fixDates(value);
        });
    }
    return data;
}

var DataContext = Microsoft.OutlookServices.Extensions.DataContext;
var Contact = Microsoft.OutlookServices.Contact;
var Contacts = Microsoft.OutlookServices.Contacts;

DataContext.prototype._originalAjax = DataContext.prototype.ajax;
DataContext.prototype.ajax = function (request) {
    var self = this;
    return new Promise(function (resolve, reject) {
        self._originalAjax(request).then(
            function (data) {
                try {
                    if (data) {
                        data = JSON.stringify(fixDates(JSON.parse(data)));
                    }
                } catch (err) {
                    console.error('Unexpected ', err, err.stack, data);
                }
                resolve(data);
            },
            reject);
    });
};

function pathFnGetContacts(context, data) {
    var self = this;
    var pathFn = function (data) {
        return self.getPath(data.Id);
    };
    return Contact.parseContacts(context, pathFn, data.value);
}

Contacts.prototype.getContacts = function () {
    return new Microsoft.OutlookServices.Extensions.CollectionQuery(this.context, this.path, pathFnGetContacts.bind(this));
};

Contacts.prototype.getContact = function (Id) {
    return new Microsoft.OutlookServices.ContactFetcher(this.context, this.getPath(Id));
};


Microsoft.OutlookServices.ContactFetcher.prototype.fetch = function () {
    var self = this;
    return new Promise(function (resolve, reject) {
        self.context.readUrl(self.path).then(
            function (data) {
                data = JSON.parse(data);
                resolve(Contact.parseContact(self.context, self.path, data));
            },
            reject);
    });
};

Contact.prototype.update = function () {
    var self = this;
    return new Promise(function (resolve, reject) {
        var request = new Microsoft.OutlookServices.Extensions.Request(self.path);
        request.method = 'PATCH';
        request.data = JSON.stringify(self.getRequestBody());
        self.context.request(request).then(
            function (data) {
                data = JSON.parse(data);
                resolve(Contact.parseContact(self.context, self.path, data));
            },
            reject);
    });
};

Contact.prototype.delete = function () {
    var self = this;
    return new Promise(function (resolve, reject) {
        var request = new Microsoft.OutlookServices.Extensions.Request(self.path);
        request.method = 'DELETE';
        self.context.request(request).then(resolve, reject);
    });
};

Contacts.prototype.addContact = function (item) {
    var self = this;
    return new Promise(function (resolve, reject) {

        var request = new Microsoft.OutlookServices.Extensions.Request(self.path);

        request.method = 'POST';
        request.data = JSON.stringify(item.getRequestBody());

        self.context.request(request).then(
            function (data) {
                data = JSON.parse(data);
                resolve(Contact.parseContact(self.context, self.getPath(data.Id), data));
            },
            reject);

    });
};

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
    var oauth2 = simpleOAuth2(normalizeConfig(config));
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
        var self = this;
        return new Promise(function (resolve, reject) {
            self.client.getToken(params, function (error, result) {
                if (error) {
                    console.error('Access Token Error: ', error);
                    reject(error);
                } else {
                    result.expires_in = +result.expires_in - 10;
                    result.expires_on = +result.expires_on;
                    result.not_before = +result.not_before;
                    resolve(result);
                }
            });
        });
    };
})();

function normalizeConfig(config) {
    return config instanceof Office365Config ? config : new Office365Config(config);
}

function createOutlookTokenFactory(config) {
    var oauth2 = createOAuth2(normalizeConfig(config));
    return oauth2.createToken().then(function (token) {
        token = oauth2.accessToken.create(token);
        return function getToken() {
            return token.expired() ?
                oauth2.createToken().then(function (newToken) {
                    token = oauth2.accessToken.create(newToken);
                    console.log('Updated token: ', token);
                    return token.token.access_token;
                }) :
                Promise.resolve(token.token.access_token);

        };
    });
}

function createOutlookClient(config) {
    return createOutlookTokenFactory(config).then(function (getToken) {
        var client = new outlook.Microsoft.OutlookServices.Client(resource + '/api/v2.0', getToken);
        return client.users.getUser(config.mailbox);
    });
}

function logMsError(error) {
    logError(error);
    if (typeof error.getAllResponseHeaders === 'function') {
        console.error('Error headers:', error.getAllResponseHeaders());
    }
}

exports.logMsError = logMsError;
exports.createOutlookClient = createOutlookClient;
exports.createOutlookTokenFactory = createOutlookTokenFactory;

exports.getODataType = function (object) {
    return object['@odata.type'];
};


var ETAG_REGEX = /^\s*(W\/)?\s*"(\S+)"\s*$/;

function getODataEtag(object, asObject) {
    var result = object['@odata.etag'];
    if (result && asObject) {
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

