'use strict';

const BaseDriver = require('../basedriver');

class CoverDriver extends BaseDriver {

    async getDeviceList(client, id=null){
        return client.getCovers(id);
    }
}

module.exports = CoverDriver;