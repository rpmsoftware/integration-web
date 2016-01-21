'use strict';
(function () {

    var util = require('util');
    var lib = require('./lib');
    var enumObjectType = require('integration-common/api-wrappers').OBJECT_TYPE;

    var headerPatterns = {
        'x-rpm-instanceid': /^\d+$/,
        'x-rpm-subscriber': /^\d+$/,
        'user-agent': /^RPM-Webhook$/,
        'content-type': /^application\/json/
    };

    function validateHeaders(headers) {
        console.log('validateHeaders()');
        for (var key in headerPatterns) {
            var value = headers[key];
            if (!headerPatterns[key].test(value)) {
                throw util.format('Invalid header %s=%s', key, value);
            }
        }
    }

    function createRpmWebHookCallback(secret, callback) {
        return function (req, res) {
            var body;
            try {
                validateHeaders(req.headers);
                validateSignature(req.headers['x-rpm-signature'], req.body, secret);
                body = JSON.parse(req.body);
                validateWebHooksRequest(body);
                body.time = new Date();
            } catch (err) {
                console.error('Validation error:', err);
                res.status(400).send(err);
                return;
            }
            res.send();
            body.InstanceID = req.headers['x-rpm-instanceid'];
            body.Instance = req.headers['x-rpm-instance'];
            body.Subscriber = req.headers['x-rpm-subscriber'];
            if (typeof callback === 'function') {
                callback(body, req);
            }
        };
    }

    exports.createRpmWebHookCallback = createRpmWebHookCallback;

    exports.start = function (config, callback) {
        return lib.startPostServer(config, createRpmWebHookCallback(config.secret, callback));
    };


    function WebHooksRequestData(processId, formId, eventName, statusId) {
        this.ObjectID = formId;
        this.ParentID = processId;
        this.EventName = eventName;
        this.RequestID = ++WebHooksRequestData.prototype.RequestId;
        this.ObjectType = enumObjectType.Form;
        this.ParentType = enumObjectType.PMTemplate;
        statusId && (this.StatusID = statusId);
        validateWebHooksRequest(this);
    };

    WebHooksRequestData.prototype.RequestId = 0;
    exports.WebHooksRequestData = WebHooksRequestData;

    exports.EVENT_FORM_START = 'form.start';
    exports.EVENT_FORM_EDIT = 'form.edit';
    exports.EVENT_FORM_TRASH = 'form.trash';
    exports.EVENT_FORM_RESTORE = 'form.restore';

    var EVENT_NAMES = [
        exports.EVENT_FORM_START,
        exports.EVENT_FORM_EDIT,
        exports.EVENT_FORM_TRASH,
        exports.EVENT_FORM_RESTORE
    ];

    function isWebHooksRequest(obj) {
        return typeof obj === 'object' &&
            typeof obj.ObjectID === 'number' &&
            typeof obj.ParentID === 'number' &&
            (!obj.StatusID || typeof obj.StatusID === 'number') &&
            EVENT_NAMES.indexOf(obj.EventName) >= 0 &&
            obj.ObjectType === enumObjectType.Form &&
            obj.ParentType === enumObjectType.PMTemplate;
    }
    
    exports.isWebHooksRequest = isWebHooksRequest;

    function validateWebHooksRequest(obj) {
        if (!isWebHooksRequest(obj)) {
            throw 'Not a WebHooksRequest';
        }
    }

    exports.WebHooksRequestHeader = function WebHooksRequestHeader(rpmInstanceID, rpmSubscriber, request, secret) {
        this['x-rpm-instanceid'] = rpmInstanceID;
        this['x-rpm-subscriber'] = rpmSubscriber;
        this['user-agent'] = 'RPM-Webhook';
        this['content-type'] = 'application/json';
        validateHeaders(this);
        validateWebHooksRequest(request);
        this['x-rpm-signature'] = getSignature(request, secret);
    };

    var crypto = require('crypto');

    function getSignature(data, secret) {
        if (secret === undefined) {
            throw new Error(util.format('Signature secret is missing'));
        }
        var hmac = crypto.createHmac('sha256', secret);
        hmac.update(typeof data === 'object' ? JSON.stringify(data) : '' + data);
        return hmac.digest('hex');
    }

    function validateSignature(signRecieved, data, secret) {
        console.log('validateSignature()');
        var signCalculated = getSignature(data, secret);
        if (signCalculated !== signRecieved) {
            throw new Error(util.format('Wrong signature. Calculated: %s, recieved: %s', signCalculated, signRecieved));
        }
    }

})();