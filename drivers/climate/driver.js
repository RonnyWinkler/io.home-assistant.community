'use strict';

const BaseDriver = require('../basedriver');

class ClimateDriver extends BaseDriver {

    async getDeviceList(client, id=null){
        return client.getClimates(id);
    }
}

module.exports = ClimateDriver;