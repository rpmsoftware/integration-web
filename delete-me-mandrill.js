const sendEmail = require('./sendemail');
const localUtil = require('./sendemail/util');

exports.parseEmail = localUtil.parseEmail;
exports.normalizeEmails = localUtil.normalizeEmails;
exports.createMessageSender = function (config) {
    config.provider = 'mandrill';
    return sendEmail.createMessageSender(config);
};

exports.createErrorNotifier = sendEmail.createErrorNotifier;