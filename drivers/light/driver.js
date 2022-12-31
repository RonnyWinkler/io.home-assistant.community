'use strict';

const BaseDriver = require('../basedriver');

class LightDriver extends BaseDriver {

    async getDeviceList(client, id=null){
        return client.getLights(id);
    }
}

module.exports = LightDriver;