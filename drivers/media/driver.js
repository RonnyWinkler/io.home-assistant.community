'use strict';

const BaseDriver = require('../basedriver');

class MediaDriver extends BaseDriver {

    async getDeviceList(client){
        return client.getMediaPlayers();
    }

}

module.exports = MediaDriver;