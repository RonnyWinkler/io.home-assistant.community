'use strict';

const BaseDevice = require('../basedevice');

class ButtonDevice extends BaseDevice {

    async onInit() {
        await super.onInit();

        this.lastState = null;

        this.registerCapabilityListener('button', async (value, opts) => {
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
        try{
            // First update, just remember the current state (last press)
            if (this.lastState == null){
                this.lastState = data.state;
                return;
            }
            // New update, raise flow trigger
            if (this.lastState != data.state){
                this.lastState = data.state;
                this.homey.app._flowTriggerButtonPressed.trigger(this);
            }
        }
        catch(error) {
            this.error("CapabilitiesUpdate error: "+ error.message);
        }
    }

    // Capabilities ===========================================================================================?
    async _onCapabilityOnoff( value, opts ) {
       // this._client.turnOnOff(this.entityId, value);
       let entityId = this.entityId;
        await this._client.callService("input_button", "press", {
            "entity_id": entityId
        });
   }
}

module.exports = ButtonDevice;