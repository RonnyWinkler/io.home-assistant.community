'use strict';

const BaseDriver = require('../basedriver');

class SwitchDriver extends BaseDriver {

    async getDeviceList(client){
        return client.getSwitches();
    }
}

module.exports = SwitchDriver;