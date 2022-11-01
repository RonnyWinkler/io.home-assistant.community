'use strict';

const BaseDriver = require('../basedriver');

class CompoundDriver extends BaseDriver {

    async getDeviceList(client){
        return client.getCompounds();
    }

}

module.exports = CompoundDriver;