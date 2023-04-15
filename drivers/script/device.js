'use strict';

const BaseDevice = require('../basedevice');

class ScriptDevice extends BaseDevice {

    async onInit() {
        await super.onInit();

        this.lastState = null;

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
        await super.onEntityUpdate(data);
        try{
            if(data && data.entity_id && data.entity_id == this.entityId) {
                // First update, just remember the current state (last press)
                if (this.lastState == null){
                    this.lastState = data.state;
                    return;
                }
                // New update, raise flow trigger
                if (this.lastState != data.state){
                    this.lastState = data.state;
                    this.homey.app._flowTriggerScriptStarted.trigger(this);
                }
            }
        }
        catch(error) {
            this.error("CapabilitiesUpdate error: "+ error.message);
        }
    }

    // Capabilities ===========================================================================================
    async _onCapabilityButton( value, opts ) {
        await this._client.turnOnOff(this.entityId, true);
    }

}

module.exports = ScriptDevice;