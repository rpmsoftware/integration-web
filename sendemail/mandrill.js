const Mandrill = require('mandrill-api/mandrill').Mandrill;
const localUtil = require('./util');

function createBasicMessageSender(apiKey) {
    let send = new Mandrill(apiKey).messages;
    send = send.send.bind(send);
    return function (message) {
        return new Promise((resolve, reject) => send({ message: message }, resolve, reject));
    };
}

function createMessageSender(apiKey, fromEmail, toEmails, ccEmails) {
    if (typeof apiKey === 'object') {
        fromEmail = apiKey.fromEmail;
        toEmails = apiKey.toEmails;
        ccEmails = apiKey.ccEmails;
        apiKey = apiKey.apiKey;
    }
    const send = createBasicMessageSender(apiKey);
    fromEmail = localUtil.parseEmail(fromEmail);
    toEmails = localUtil.normalizeEmails(toEmails);
    if (ccEmails) {
        toEmails = toEmails.concat(localUtil.normalizeEmails(ccEmails, 'cc'));
    }
    if (!toEmails.length) {
        throw new Error('There has to be at least one recipient');
    }
    return function (subject, messageBody, sendAsHtml) {
        const message = {
            subject: subject,
            from_email: fromEmail.email,
            from_name: fromEmail.name,
            to: toEmails,
        };
        if (messageBody) {
            message[sendAsHtml ? 'html' : 'text'] = messageBody;
        }
        return send(message);
    };
}

exports.createMessageSender = createMessageSender;
