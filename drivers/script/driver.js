'use strict';

const BaseDriver = require('../basedriver');

class ScriptDriver extends BaseDriver {

    async getDeviceList(client, id=null){
        return client.getScripts(id);
    }
}

module.exports = ScriptDriver;