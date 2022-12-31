'use strict';

const BaseDriver = require('../basedriver');

class SwitchDriver extends BaseDriver {

    async getDeviceList(client, id=null){
        return client.getSwitches(id);
    }
}

module.exports = SwitchDriver;