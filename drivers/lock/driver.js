'use strict';

const BaseDriver = require('../basedriver');

class LockDriver extends BaseDriver {

    async getDeviceList(client, id=null){
        return client.getLocks(id);
    }
}

module.exports = LockDriver;