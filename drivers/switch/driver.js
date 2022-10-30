'use strict';

const BaseDriver = require('../basedriver');

class SwitchDriver extends BaseDriver {

    async getDevices(client){
        return client.getSwitches();
    }
}

module.exports = SwitchDriver;