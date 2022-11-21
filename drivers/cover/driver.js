'use strict';

const BaseDriver = require('../basedriver');

class CoverDriver extends BaseDriver {

    async getDeviceList(client){
        return client.getCovers();
    }
}

module.exports = CoverDriver;