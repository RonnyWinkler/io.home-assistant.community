'use strict';

const BaseDriver = require('../basedriver');

class ScheduleDriver extends BaseDriver {

    async getDeviceList(client, id=null){
        return client.getSchedules(id);
    }
}

module.exports = ScheduleDriver;