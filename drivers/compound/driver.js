'use strict';

const BaseDriver = require('../basedriver');

class CompoundDriver extends BaseDriver {

    async getDeviceList(client, id=null){
        return client.getCompounds(id);
    }

}

module.exports = CompoundDriver;