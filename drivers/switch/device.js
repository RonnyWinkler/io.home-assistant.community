'use strict';

const BaseDevice = require('../basedevice');

class SwitchDevice extends BaseDevice {

    async onInit() {
        await super.onInit();

        // Capability listener for device capabilities
        this.registerCapabilityListener('onoff', async (value, opts) => {
            await this._onCapabilityOnoff(value, opts);
        });
        
        // maintenance actions
        this.registerCapabilityListener('button.reconnect', async () => {
            await this.clientReconnect()
        });
    }

    async updateCapabilities(){
        // Add new capabilities (if not already added)
        try{
            if (!this.hasCapability('button.reconnect'))
            {
            await this.addCapability('button.reconnect');
            }
        }
        catch(error){
            this.error("Error adding capability: "+error.message);
        }
    }

    // Entity update ============================================================================================
    async onEntityUpdate(data) {
        if(data) {
            await this.setCapabilityValue("onoff", data.state == "on");
        }
    }

    // Capabilities ===========================================================================================
    async _onCapabilityOnoff( value, opts ) {
        await this._client.turnOnOff(this.entityId, value);
    }

}

module.exports = SwitchDevice;