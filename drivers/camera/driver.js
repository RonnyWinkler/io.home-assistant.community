'use strict';

const BaseDriver = require('../basedriver');

class CameraDriver extends BaseDriver {

    async getDeviceList(client, id=null){
        return client.getCameras(id);
    }
}

module.exports = CameraDriver;