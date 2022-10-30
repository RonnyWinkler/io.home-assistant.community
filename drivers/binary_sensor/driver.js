'use strict';

const BaseDriver = require('../basedriver');

class BinarySensorDriver extends BaseDriver {

    async getDevices(client){
        return client.getBinarySensors();
    }

}

module.exports = BinarySensorDriver;