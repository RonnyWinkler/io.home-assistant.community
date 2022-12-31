'use strict';

const BaseDriver = require('../basedriver');

class SceneDriver extends BaseDriver {

    async getDeviceList(client, id=null){
        return client.getScenes(id);
    }
}

module.exports = SceneDriver;