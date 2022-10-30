'use strict';

const BaseDriver = require('../basedriver');

class ScriptDriver extends BaseDriver {

    async getDevices(client){
        return client.getScripts();
    }
}

module.exports = ScriptDriver;