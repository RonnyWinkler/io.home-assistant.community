'use strict';

const BaseDevice = require('../basedevice');

class LawnmowerDevice extends BaseDevice {

    async onInit() {
        await super.onInit();

        // Capability listener for device capabilities
        this.registerCapabilityListener('mower_state', async (value, opts) => {
            await this._onCapabilityMowerState(value, opts);
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
        await super.onEntityUpdate(data);
        if(data && data.entity_id && data.entity_id == this.entityId && data.attributes != undefined && data.attributes.activity != undefined){
            switch ( data.attributes.activity ){
                case 'mowing':
                    await this.setCapabilityValue("mower_state", 'mowing');
                    break;
                case 'docked':
                    await this.setCapabilityValue("mower_state", 'docked');
                    break;
                case 'paused':
                    await this.setCapabilityValue("mower_state", 'paused');
                    break;
                case 'error':
                    await this.setCapabilityValue("mower_state", 'error');
                    break;
            } 
        }
    }

    // Capabilities ===========================================================================================
    async _onCapabilityMowerState( value, opts ) {
        this.log("Lawn Mower State activity changed: "+value);
        let entityId = this.entityId;
        switch (value){
            case "mowing":
                await this._client.callService("lawn_mower", "start_mowing", {
                    "entity_id": entityId
                });
                break;
            case "docked":
                await this._client.callService("lawn_mower", "dock", {
                    "entity_id": entityId
                });
                break;
            case "paused":
                await this._client.callService("lawn_mower", "pause", {
                    "entity_id": entityId
                });
                break;
        }
        return true;
    }

    // Device functions ===========================================================================================
    // async lockOpen(args){
    //     await this._onCapabilityLockOpen();
    // }
}

module.exports = LawnmowerDevice;