var outlook = require("node-outlook").Microsoft.OutlookServices;
var promised = require('promised-io/promise');
var rpmUtil = require('integration-common/util');
var office365 = require('./office365');

var config = rpmUtil.readConfig(undefined, 'config.json').office365;

var outlookContacts;
promised.seq([
    function () {
        return office365.createOutlookClient(config);
    },
    function (outlookClient) {
        console.log('outlookClient',outlookClient,outlookClient.contacts);
        if (!outlookContacts) {
            outlookContacts = outlookClient.contacts;
        }
        return outlookContacts;
    },
    function (outlookContacts) {
        return outlookContacts.getContacts().fetchAll();
    },
    function (contacts) {
        console.log(contacts);
    }

]);