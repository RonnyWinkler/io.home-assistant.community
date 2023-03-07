'use strict';

const BaseDriver = require('../basedriver');

class WaterHeaterDriver extends BaseDriver {

    async getDeviceList(client, id=null){
        return client.getWaterHeaters(id);
    }
}

module.exports = WaterHeaterDriver;