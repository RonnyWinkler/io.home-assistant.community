'use strict';

const BaseDriver = require('../basedriver');

class ClimateFanDriver extends BaseDriver {

    async getDeviceList(client){
        return client.getClimateFans();
    }
}

module.exports = ClimateFanDriver;