'use strict';

const BaseDriver = require('../basedriver');

class FanDriver extends BaseDriver {

    async getDeviceList(client){
        return client.getFans();
    }
}

module.exports = FanDriver;