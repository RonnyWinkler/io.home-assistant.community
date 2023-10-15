'use strict';

const BaseDriver = require('../basedriver');

class AlarmControlPanelDriver extends BaseDriver {

    async getDeviceList(client, id=null){
        return client.getAlarmControlPanels(id);
    }
}

module.exports = AlarmControlPanelDriver;