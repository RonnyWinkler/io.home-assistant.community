'use strict';

const BaseDriver = require('../basedriver');

class VacuumDriver extends BaseDriver {

    async getDeviceList(client){
        return client.getVacuums();
    }
}

module.exports = VacuumDriver;