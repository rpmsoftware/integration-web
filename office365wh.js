/* global Promise */
var uuid = require('node-uuid');
var Microsoft = require("node-outlook").Microsoft;
var outlook = Microsoft.OutlookServices;
var office365 = require('./office365');


var ODATA_TYPE_PUSH_SUBSCRIPTION = "#Microsoft.OutlookServices.PushSubscription";

var SUBSCRIPTION_DAYS_TO_LIVE = 3;


function Subscription(context, path, data) {
    outlook.Entity.call(this, context, path, data);
    this._odataType = ODATA_TYPE_PUSH_SUBSCRIPTION;

    if (!data) {
        return;
    }

    this._Resource = data.Resource;
    this._ClientState = data.ClientState;
    this._NotificationURL = data.NotificationURL;
    this._ExpirationTime = new Date(data.SubscriptionExpirationDateTime).getTime();
    this._ChangeType = data.ChangeType;
    this._AquiredTime = Date.now();
    this._ttl = this._ExpirationTime - this._AquiredTime;

}

Subscription.prototype = Object.create(outlook.Entity.prototype);

Object.defineProperty(Subscription.prototype, "resource", {
    get: function () {
        return this._Resource;
    },
    enumerable: true,
    configurable: true
});

Object.defineProperty(Subscription.prototype, "clientState", {
    get: function () {
        return this._ClientState;
    },
    enumerable: true,
    configurable: true
});

Object.defineProperty(Subscription.prototype, "notificationURL", {
    get: function () {
        return this._NotificationURL;
    },
    enumerable: true,
    configurable: true
});

Object.defineProperty(Subscription.prototype, "changeType", {
    get: function () {
        return this._ChangeType;
    },
    enumerable: true,
    configurable: true
});


Object.defineProperty(Subscription.prototype, "expirationTime", {
    get: function () {
        return new Date(this._ExpirationTime);
    },
    enumerable: true,
    configurable: true
});

Object.defineProperty(Subscription.prototype, "aquiredTime", {
    get: function () {
        return new Date(this._AquiredTime);
    },
    enumerable: true,
    configurable: true
});

Subscription.prototype.update = function () {
    var self = this;
    return new Promise((resolve, reject) => {

        var request = new outlook.Extensions.Request(self.path);

        request.method = 'PATCH';


        var exp = new Date();
        exp.setDate(exp.getDate() + SUBSCRIPTION_DAYS_TO_LIVE);
        exp.setMilliseconds(0);
        exp.setMinutes(0);
        exp.setSeconds(0);
        exp.setHours(0);

        request.data = {
            '@odata.type': ODATA_TYPE_PUSH_SUBSCRIPTION,
            SubscriptionExpirationDateTime: exp
        };

        self.context.request(request).then(data => {
            self._AquiredTime = Date.now();
            self._ExpirationTime = exp.getTime();
            resolve(data);
        }, reject);
    });
};

Subscription.prototype.expired = function () {
    return this._ExpirationTime < Date.now();
};

function Subscriptions(context, path) {
    outlook.EntityFetcher.call(this, context, path);
}

Subscriptions.prototype = Object.create(outlook.EntityFetcher.prototype);

var CHANGE_TYPE_CREATED = exports.CHANGE_TYPE_CREATED = 'Created';
var CHANGE_TYPE_UPDATED = exports.CHANGE_TYPE_UPDATED = 'Updated';
var CHANGE_TYPE_DELETED = exports.CHANGE_TYPE_DELETED = 'Deleted';
var CHANGE_TYPE_MISSED = exports.CHANGE_TYPE_MISSED = 'Missed';

var CHANGE_TYPES = {};

var normalizeChangeTypes = (() => {
    [CHANGE_TYPE_CREATED, CHANGE_TYPE_DELETED, CHANGE_TYPE_UPDATED, CHANGE_TYPE_MISSED].forEach((changeType) => {
        CHANGE_TYPES[changeType] = changeType;
        CHANGE_TYPES[changeType.toLowerCase()] = changeType;
    });
    var SEPARATOR = ',';
    return function (changeTypes) {
        if (typeof changeTypes === 'string') {
            changeTypes = changeTypes.split(SEPARATOR);
        }
        if (!Array.isArray(changeTypes)) {
            throw Error('Array or comma separated string is expected');
        }
        for (var ii = 0; ii < changeTypes.length; ii++) {
            var typ = (changeTypes[ii] || '').trim();
            var normalized = CHANGE_TYPES[typ.toLowerCase()];
            if (!normalized) {
                throw new Error('Unknown ChangeType: ' + typ);
            }
            changeTypes[ii] = normalized;
        }
        return changeTypes.join(SEPARATOR);
    };
})();

Subscriptions.prototype.get = function (id) {
    var request = new outlook.Extensions.Request(this.getPath(id));
    var self = this;
    return new Promise((resolve, reject) => self.context.request(request).then(data => {
        data = JSON.parse(data);
        data = new Subscription(self.context, self.getPath(data.Id), data);
        resolve(data);
    }, reject));
};

Subscriptions.prototype.delete = function (id) {
    return this.get(id).then(subscription => subscription.delete());
};

Subscriptions.prototype.create = function (resource, callbackUrl, changeTypes, clientState) {
    if (typeof resource === 'object' && resource.context !== this.context) {
        throw new Error('Wrong resource context');
    }
    var request = new outlook.Extensions.Request(this.path);
    request.method = 'POST';
    request.data = JSON.stringify({
        '@odata.type': ODATA_TYPE_PUSH_SUBSCRIPTION,
        Resource: resource.path || resource,
        NotificationURL: callbackUrl,
        ChangeType: normalizeChangeTypes(changeTypes),
        ClientState: clientState || uuid.v4()
    });
    var self = this;
    return new Promise((resolve, reject) => self.context.request(request).then(data => {
        data = JSON.parse(data);
        data = new Subscription(self.context, self.getPath(data.Id), data);
        resolve(data);
    }, reject));
};

Object.defineProperty(outlook.UserFetcher.prototype, "subscriptions", {
    get: function () {
        if (this._Subscriptions === undefined) {
            this._Subscriptions = new Subscriptions(this.context, this.getPath('Subscriptions'));
        }
        return this._Subscriptions;
    },
    enumerable: true,
    configurable: true
});

(() => {
    var parseEntityOriginal = outlook.Entity.parseEntity;
    outlook.Entity.parseEntity = function (context, path, data) {
        return (data && data['@odata.type'] === ODATA_TYPE_PUSH_SUBSCRIPTION) ? new Subscription(context, path, data) : parseEntityOriginal(context, path, data);
    };
})();

exports.Subscription = Subscription;

function isResource(object) {
    return Boolean(object &&
        office365.getODataType(object) &&
        object['@odata.id'] &&
        office365.getODataEtag(object) &&
        object.Id);
}

exports.isResource = isResource;

var ODATA_TYPE_NOTIFICATION = "#Microsoft.OutlookServices.Notification";

exports.isNotification = function (object) {
    var changeType = CHANGE_TYPES[object.ChangeType];
    return Boolean(office365.getODataType(object) === ODATA_TYPE_NOTIFICATION &&
        typeof object.SequenceNumber === 'number' &&
        object.SubscriptionId &&
        object.SubscriptionExpirationDateTime &&
        changeType &&
        (object.Resource && isResource(object.ResourceData)) || changeType === CHANGE_TYPE_MISSED);
};

function respondToSubscriptionValidation(req, res) {
    var validationToken = req.query.validationtoken;
    if (validationToken) {
        res.type('txt');
        res.status(200);
        console.log('Responding to Subscription Validation Request with "%s"', validationToken);
        res.send(validationToken);
    }
    return !!validationToken;
}

exports.createOffice365WebHookCallback = function (callback) {

    return function (req, res) {
        try {
            if (respondToSubscriptionValidation(req, res)) {
                return;
            }
            res.send();
            var body = JSON.parse(req.body);
            body.clientState = req.headers.clientstate;
            if (typeof callback === 'function') {
                callback(body, req);
            }
        } catch (error) {
            office365.logMsError(error);
        }
    };

};

