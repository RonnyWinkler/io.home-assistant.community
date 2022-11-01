'use strict';

const BaseDriver = require('../basedriver');

class SceneDriver extends BaseDriver {

    async getDeviceList(client){
        return client.getScenes();
    }
}

module.exports = SceneDriver;