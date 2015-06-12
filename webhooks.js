'use strict';
(function() {

var util = require('util'); 
var express = require('express'); 
var bodyParser = require('body-parser')
var enumObjectType = require('integration-common/api-wrappers').OBJECT_TYPE;



var headerPatterns = { 
    'x-rpm-deployment': /^telco|cube$/,
     // 'x-rpm-subscriber': /\w+/, TODO
    'user-agent': /^RPM-Webhook$/,
    'content-type': /^application\/json/};
    
function validateHeaders (headers) {
    for(var key in headerPatterns) {
        var value = headers[key];
        if(!headerPatterns[key].test(value)){
            throw util.format('Invalid header %s=%s', key, value);
        }
    }
}


function normalizePath(path) {
    var slash = '/';
    if(path) {
        path = path.trim();
        if(path[0]!==slash) {
            path = slash+path;
        }
    } else {
        path = slash;
    }
    return path;
}

exports.start = function (port, path, callback) {
    var app = express();    
    app.use(bodyParser.json());
    app.post(normalizePath(path), function (req, res) {
        res.contentType = 'plain/text';
        try {
            validateHeaders(req.headers);
            validateWebHooksRequest(req.body);
        } catch(err) {
            res.status(400).send(err);
            return;
        }
        res.send();
        req.body.Deployment = req.headers['x-rpm-deployment'];
        req.body.Subscriber = req.headers['x-rpm-subscriber'];
        if(typeof callback==='function') {
            callback(req.body, req);
        }
    });
    return app.listen(port);
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

var EVENT_NAMES = ['form.start','form.edit'];

function validateWebHooksRequest (obj) {
    if(typeof obj==='object' &&
        typeof obj.ObjectID ==='number' && 
        typeof obj.ParentID==='number' && 
        EVENT_NAMES.indexOf(obj.EventName)>=0 &&
        obj.ObjectType === enumObjectType.Form &&
        obj.ParentType === enumObjectType.PMTemplate) {
        return;
    }
    throw 'Not a WebHooksRequest';
}


exports.WebHooksRequestHeader = function WebHooksRequestHeader(rpmDeployment, rpmSubscriber) {
    this['x-rpm-deployment']=  rpmDeployment;
    this['x-rpm-subscriber']= rpmSubscriber;
    this['user-agent']= 'RPM-Webhook';
    this['content-type']= 'application/json';
    validateHeaders(this);
};



})();