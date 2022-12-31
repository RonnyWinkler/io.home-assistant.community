'use strict';

const BaseDriver = require('../basedriver');

class SensorDriver extends BaseDriver {

    async getDeviceList(client, id=null){
        return client.getSensors(id);
    }
}

module.exports = SensorDriver;