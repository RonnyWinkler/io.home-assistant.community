'use strict';

const BaseDriver = require('../basedriver');

class ScheduleDriver extends BaseDriver {

    async getDeviceList(client){
        return client.getSchedules();
    }
}

module.exports = ScheduleDriver;