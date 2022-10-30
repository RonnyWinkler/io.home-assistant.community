'use strict';

const BaseDriver = require('../basedriver');

class CompoundDriver extends BaseDriver {

    async getDevices(client){
        return client.getCompounds();
    }

}

module.exports = CompoundDriver;