'use strict';

const BaseDriver = require('../basedriver');

class ClimateDriver extends BaseDriver {

    async getDeviceList(client){
        return client.getClimates();
    }
}

module.exports = ClimateDriver;