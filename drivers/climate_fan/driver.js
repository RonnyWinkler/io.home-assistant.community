'use strict';

const BaseDriver = require('../basedriver');

class ClimateFanDriver extends BaseDriver {

    async getDeviceList(client, id=null){
        return client.getClimateFans(id);
    }
}

module.exports = ClimateFanDriver;