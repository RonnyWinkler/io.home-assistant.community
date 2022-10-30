'use strict';

const BaseDriver = require('../basedriver');

class MediaDriver extends BaseDriver {

    async getDevices(client){
        return client.getMediaPlayers();
    }

}

module.exports = MediaDriver;