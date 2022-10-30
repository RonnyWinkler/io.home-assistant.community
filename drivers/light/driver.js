'use strict';

const BaseDriver = require('../basedriver');

class LightDriver extends BaseDriver {

    async getDevices(client){
        return client.getLights();
    }
}

module.exports = LightDriver;