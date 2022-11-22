'use strict';

const BaseDriver = require('../basedriver');

class LockDriver extends BaseDriver {

    async getDeviceList(client){
        return client.getLocks();
    }
}

module.exports = LockDriver;