'use strict';

const BaseDriver = require('../basedriver');

class CustomDriver extends BaseDriver {

    async getDeviceList(client, id=null){
        return [
            {
                name: this.homey.__("pair.custom_device.device_name"),
                data: {
                    id: this.getUIID()
                }
            }
        ];
    }

    getUIID() {
        function s4() {
            return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
        }
        return `${s4() + s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
    }

}

module.exports = CustomDriver;