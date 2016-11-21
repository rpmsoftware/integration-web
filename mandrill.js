var Mandrill = require('mandrill-api/mandrill').Mandrill;
var logErrorStack = require('integration-common/util').logErrorStack;
var util = require('util');

var parseEmail = (() => {
    var p = /(^\s*(\S.*\S)\s*<\s*([\w\.]+@[\w\.]+)\s*>\s*$)|(^\s*([\w\.]+@[\w\.]+)\s*$)/;

    return function (str) {
        var parts = str.match(p);
        if (!parts) {
            throw new Error('Bad email format: ' + str);
        }
        return {
            email: parts[3] || parts[5],
            name: parts[2]
        };
    };
})();

function normalize(emails, typ) {
    var result = Array.isArray(emails) ? emails.map(parseEmail) : [parseEmail(emails)];
    if (typ) {
        result.forEach(email => email.type = typ);
    }
    return result;
}


function createMessageSender(apiKey, fromEmail, toEmails, ccEmails) {
    if (typeof apiKey === 'object') {
        fromEmail = apiKey.fromEmail;
        toEmails = apiKey.toEmails;
        ccEmails = apiKey.ccEmails;
        apiKey = apiKey.apiKey;
    }
    var send = new Mandrill(apiKey).messages;
    send = send.send.bind(send);

    fromEmail = parseEmail(fromEmail);
    toEmails = normalize(toEmails);
    ccEmails = ccEmails ? normalize(ccEmails, 'cc') : undefined;
    if (!toEmails.length && !ccEmails.length) {
        throw new Error('There has to be at least one recipient');
    }
    return function (subject, messageBody, sendAsHtml) {
        var message = {
            subject: subject,
            from_email: fromEmail.email,
            from_name: fromEmail.name,
            to: toEmails,
        };
        if (messageBody) {
            message[sendAsHtml ? 'html' : 'text'] = messageBody;
        }
        return new Promise((resolve, reject) => {
            send({ message: message }, resolve, reject);
        });
    };
}

exports.createMessageSender = createMessageSender;

exports.createErrorNotifier = function (config, sendMessage) {
    if (typeof sendMessage !== 'function') {
        sendMessage = createMessageSender(config);
    }
    return function (error, subject) {
        logErrorStack(error);
        if (subject === undefined) {
            subject = error && error.toString();
        }
        if (error instanceof Error) {
            error = error.stack;
        } else if (typeof error === 'object') {
            error = util.format('%j', error);
        }
        sendMessage(subject, error).then(undefined, logErrorStack);
    };
};
