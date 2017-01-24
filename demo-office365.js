var rpmUtil = require('integration-common/util');
var office365 = require('./office365');

var config = rpmUtil.readConfig(undefined, 'config.json').office365;
var outlookContacts;

office365.createOutlookClient(config)
    .then(outlookClient => {
        console.log('outlookClient', outlookClient, outlookClient.contacts);
        if (!outlookContacts) {
            outlookContacts = outlookClient.contacts;
        }
        return outlookContacts;
    })
    .then(outlookContacts => outlookContacts.getContacts().fetchAll())
    .then(console.log, office365.logMsError);