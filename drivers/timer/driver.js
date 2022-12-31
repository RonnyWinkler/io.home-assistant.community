'use strict';

const BaseDriver = require('../basedriver');

class TimerDriver extends BaseDriver {

    async getDeviceList(client, id=null){
        return client.getTimers(id);
    }
}

module.exports = TimerDriver;