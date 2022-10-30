'use strict';

const BaseDriver = require('../basedriver');

class SceneDriver extends BaseDriver {

    async getDevices(client){
        return client.getScenes();
    }
}

module.exports = SceneDriver;