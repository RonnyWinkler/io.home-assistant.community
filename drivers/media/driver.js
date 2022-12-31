'use strict';

const BaseDriver = require('../basedriver');

class MediaDriver extends BaseDriver {

    async getDeviceList(client, id=null){
        return client.getMediaPlayers(id);
    }

}

module.exports = MediaDriver;