'use strict';

const BaseDevice = require('../basedevice');

class SceneDevice extends BaseDevice {

    async onInit() {
        await super.onInit();

        this.registerCapabilityListener('button', async (value, opts) => {
            await this._onCapabilityButton(value, opts);
        })
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
        // nothing to update
    }

    // Capabilities ===========================================================================================
    async _onCapabilityButton( value, opts ) {
        await this._client.turnOnOff(this.entityId, true);
    }
    
}

module.exports = SceneDevice;