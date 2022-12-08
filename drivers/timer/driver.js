'use strict';

const BaseDriver = require('../basedriver');

class TimerDriver extends BaseDriver {

    async getDeviceList(client){
        return client.getTimers();
    }
}

module.exports = TimerDriver;