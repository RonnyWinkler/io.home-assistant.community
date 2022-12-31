'use strict';

const BaseDriver = require('../basedriver');

class PresenceDriver extends BaseDriver {

    async getDeviceList(client, id=null){
        return client.getPresence(id);
    }
}

module.exports = PresenceDriver;