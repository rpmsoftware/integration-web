const rpmUtil = require('integration-common/util');

const EMAIL_PATTERN = /(^\s*(\S.*\S)\s*<\s*([\w.]+@[\w.]+)\s*>\s*$)|(^\s*([\w.]+@[\w.]+)\s*$)/;

function parseEmail(str) {
    const parts = str.match(EMAIL_PATTERN);
    if (!parts) {
        throw new Error('Bad email format: ' + str);
    }
    return {
        email: parts[3] || parts[5],
        name: parts[2]
    };
}


function normalizeEmails(emails, typ) {
    const result = rpmUtil.toArray(emails).map(parseEmail);
    typ && result.forEach(email => email.type = typ);
    return result;
}

exports.normalizeEmails = normalizeEmails;
exports.parseEmail = parseEmail;