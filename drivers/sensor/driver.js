'use strict';

const BaseDriver = require('../basedriver');

class SensorDriver extends BaseDriver {

    async getDevices(client){
        return client.getSensors();
    }
}

module.exports = SensorDriver;