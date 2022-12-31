'use strict';

const BaseDriver = require('../basedriver');

class VacuumDriver extends BaseDriver {

    async getDeviceList(client, id=null){
        return client.getVacuums(id);
    }
}

module.exports = VacuumDriver;