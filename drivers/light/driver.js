'use strict';

const BaseDriver = require('../basedriver');

class LightDriver extends BaseDriver {

    async getDeviceList(client){
        return client.getLights();
    }
}

module.exports = LightDriver;