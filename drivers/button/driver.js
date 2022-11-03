'use strict';

const BaseDriver = require('../basedriver');

class ButtonDriver extends BaseDriver {

    async getDeviceList(client){
        return client.getButtons();
    }
}

module.exports = ButtonDriver;