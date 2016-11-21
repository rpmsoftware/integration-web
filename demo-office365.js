var rpmUtil = require('integration-common/util');
var office365 = require('./office365');

var config = rpmUtil.readConfig(undefined, 'config.json').office365;
var outlookContacts;

var p = office365.createOutlookClient(config);
p = p.then(function (outlookClient) {
    console.log('outlookClient', outlookClient, outlookClient.contacts);
    if (!outlookContacts) {
        outlookContacts = outlookClient.contacts;
    }
    return outlookContacts;
});
p = p.then(function (outlookContacts) {
    return outlookContacts.getContacts().fetchAll();
});
p = p.then(function (contacts) {
    console.log(contacts);
}, office365.logMsError);