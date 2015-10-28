var uuid = require('node-uuid');
var Microsoft = require("node-outlook").Microsoft;
var outlook = Microsoft.OutlookServices;
var Deferred = Microsoft.Utility.Deferred;

var ODATA_TYPE_PUSH_SUBSCRIPTION = "#Microsoft.OutlookServices.PushSubscription";

function Subscription(context, path, data) {
	outlook.Entity.call(this, context, path, data);
	this._odataType = ODATA_TYPE_PUSH_SUBSCRIPTION;

	if (!data) {
		return;
	}

	this._ResourceURL = data.resource;
	this._ClientState = data.context;
	this._CallbackURL = data.notificationURL;
	this._ExpirationTime = new Date(data.subscriptionExpirationDateTime).getTime();
	this._ChangeType = data.changeType;
	this._AquiredTime = Date.now();
	this._ttl = this._ExpirationTime - this._AquiredTime;
}

Subscription.prototype = Object.create(outlook.Entity.prototype);

Object.defineProperty(Subscription.prototype, "resourceURL", {
	get: function () {
		return this._ResourceURL;
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

Object.defineProperty(Subscription.prototype, "callbackURL", {
	get: function () {
		return this._CallbackURL;
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
	var _this = this;
	var deferred = new Deferred();
	var request = new outlook.Extensions.Request(this.getPath('renew'));

	request.method = 'POST';

	var expirationTime = Date.now() + this._ttl;

	this.context.request(request).then(function (data) {
		_this._AquiredTime = Date.now();
		_this._ExpirationTime = expirationTime;
		deferred.resolve(data);
	}, deferred.reject.bind(deferred));
	return deferred;
};

Subscription.prototype.expired = function () {
	return this._ExpirationTime < Date.now();
};

function Subscriptions(context, path) {
	outlook.EntityFetcher.call(this, context, path);
	this._Existing = [];
}

Subscriptions.prototype = Object.create(outlook.EntityFetcher.prototype);

var CHANGE_TYPE_CREATED = exports.CHANGE_TYPE_CREATED = 'Created';
var CHANGE_TYPE_UPDATED = exports.CHANGE_TYPE_UPDATED = 'Updated';
var CHANGE_TYPE_DELETED = exports.CHANGE_TYPE_DELETED = 'Deleted';

var normalizeChangeTypes = (function () {
	var CHANGE_TYPES = {};
	[CHANGE_TYPE_CREATED, CHANGE_TYPE_DELETED, CHANGE_TYPE_UPDATED].forEach(function (ct) {
		CHANGE_TYPES[ct.toLowerCase()] = ct;
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

Subscriptions.prototype.create = function (resource, callbackUrl, changeTypes, clientState) {
	if (resource.context !== this.context) {
		throw new Error('Wrong resource context');
	}
	var request = new outlook.Extensions.Request(this.path);
	request.method = 'POST';
	request.data = JSON.stringify({
		'@odata.type': ODATA_TYPE_PUSH_SUBSCRIPTION,
		resource: resource.path,
		notificationURL: callbackUrl,
		changeType: normalizeChangeTypes(changeTypes),
		context: clientState || uuid.v4()
	});
	var _this = this;
	var deferred = new Deferred();
	this.context.request(request).then((function (data) {
		data = JSON.parse(data);
		data = new Subscription(_this.context, data['@odata.id'], data);
		this._Existing.push(data);
		deferred.resolve(data);
	}).bind(this), deferred.reject.bind(deferred));
	return deferred;
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

(function () {
	var parseEntityOriginal = outlook.Entity.parseEntity;
	outlook.Entity.parseEntity = function (context, path, data) {
		return (data && data['@odata.type'] === ODATA_TYPE_PUSH_SUBSCRIPTION) ? new Subscription(context, path, data) : parseEntityOriginal(context, path, data);
	};
})();

exports.Subscription = Subscription;