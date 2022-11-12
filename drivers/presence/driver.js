'use strict';

const BaseDriver = require('../basedriver');

class PresenceDriver extends BaseDriver {

    async getDeviceList(client){
        return client.getPresence();
    }
}

module.exports = PresenceDriver;