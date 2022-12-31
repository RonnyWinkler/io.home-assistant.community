'use strict';

const BaseDriver = require('../basedriver');

class FanDriver extends BaseDriver {

    async getDeviceList(client, id=null){
        return client.getFans(id);
    }
}

module.exports = FanDriver;