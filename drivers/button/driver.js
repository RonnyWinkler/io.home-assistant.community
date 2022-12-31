'use strict';

const BaseDriver = require('../basedriver');

class ButtonDriver extends BaseDriver {

    async getDeviceList(client, id=null){
        return client.getButtons(id);
    }
}

module.exports = ButtonDriver;