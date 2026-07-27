'use strict';

const BaseDriver = require('../basedriver');

class LawnmowerDriver extends BaseDriver {

    async getDeviceList(client, id=null){
        return client.getLawnmowers(id);
    }
}

module.exports = LawnmowerDriver;