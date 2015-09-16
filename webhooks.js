'use strict';
(function () {

    var util = require('util');
    var lib = require('./lib');
    var enumObjectType = require('integration-common/api-wrappers').OBJECT_TYPE;


    var headerPatterns = { 
        'x-rpm-instance': /^\S+$/,
        'x-rpm-subscriber': /^\d+$/,
        'user-agent': /^RPM-Webhook$/,
        'content-type': /^application\/json/
    };

    function validateHeaders(headers) {
        for (var key in headerPatterns) {
            var value = headers[key];
            if (!headerPatterns[key].test(value)) {
                throw util.format('Invalid header %s=%s', key, value);
            }
        }
    }

    exports.start = function () {
        
        var last = arguments.length-1;
        var callback = arguments[last];
        
        arguments[last] = function (req, res) {
            res.contentType = 'plain/text';
            try {
                validateHeaders(req.headers);
                validateWebHooksRequest(req.body);
            } catch (err) {
                console.error(err);
                res.status(400).send(err);
                return;
            }
            res.send();
            req.body.Instance = req.headers['x-rpm-instance'];
            req.body.Subscriber = req.headers['x-rpm-subscriber'];
            if (typeof callback === 'function') {
                callback(req.body, req);
            }
        };
        
        return lib.startJsonPostServer.apply(undefined, arguments);
    };

    function WebHooksRequestData(processId, formId, eventName) {
        this.ObjectID = formId;
        this.ParentID = processId;
        this.EventName = eventName;
        this.RequestID = ++WebHooksRequestData.prototype.RequestId;
        this.ObjectType = enumObjectType.Form;
        this.ParentType = enumObjectType.PMTemplate;
        validateWebHooksRequest(this);
    };

    WebHooksRequestData.prototype.RequestId = 0;
    exports.WebHooksRequestData = WebHooksRequestData;

    exports.EVENT_FORM_START = 'form.start';
    exports.EVENT_FORM_EDIT = 'form.edit';

    var EVENT_NAMES = [
        exports.EVENT_FORM_START,
        exports.EVENT_FORM_EDIT
    ];

    function validateWebHooksRequest(obj) {
        if (typeof obj === 'object' &&
            typeof obj.ObjectID === 'number' &&
            typeof obj.ParentID === 'number' &&
            EVENT_NAMES.indexOf(obj.EventName) >= 0 &&
            obj.ObjectType === enumObjectType.Form &&
            obj.ParentType === enumObjectType.PMTemplate) {
            return;
        }
        throw 'Not a WebHooksRequest';
    }


    exports.WebHooksRequestHeader = function WebHooksRequestHeader(rpmDeployment, rpmSubscriber) {
        this['x-rpm-instance'] = rpmDeployment;
        this['x-rpm-subscriber'] = rpmSubscriber;
        this['user-agent'] = 'RPM-Webhook';
        this['content-type'] = 'application/json';
        validateHeaders(this);
    };



})();