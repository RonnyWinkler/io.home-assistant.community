'use strict';

const BaseDriver = require('../basedriver');

class ScriptDriver extends BaseDriver {

    async getDeviceList(client){
        return client.getScripts();
    }
}

module.exports = ScriptDriver;