'use strict';

const BaseDriver = require('../basedriver');

class SensorDriver extends BaseDriver {

    async getDeviceList(client){
        return client.getSensors();
    }
}

module.exports = SensorDriver;