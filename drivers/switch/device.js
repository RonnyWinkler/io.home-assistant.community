'use strict';

const BaseDevice = require('../basedevice');

class SwitchDevice extends BaseDevice {

    async onInit() {
        this._settings = this.getSettings();
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

    getPowerEntityId(){
        try{
            let powerSetting = this._settings.power_entity; 
            if (this._settings.add_power_entity && powerSetting && powerSetting != "" ){
                return powerSetting;
            }
            else{
                let entityId = "sensor." + this.entityId.split('.')[1] + "_power"; 
                return entityId;
            }
        }
        catch(error){
            this.error("Error getting power entity ID for device "+this.entityId);
            return null;
        }
    }

    // Entity update ============================================================================================
    async onEntityUpdate(data) {
        await super.onEntityUpdate(data);

        if(data && data.entity_id && data.entity_id == this.entityId) {
            await this.setCapabilityValue("onoff", data.state == "on");
        }
    }

    // Capabilities ===========================================================================================
    async _onCapabilityOnoff( value, opts ) {
        await this._client.turnOnOff(this.entityId, value);
    }

    
    // Settings ================================================================================================
    async onSettings(settings){
        try {
            this._settings = settings.newSettings;
            await this.connectPowerEntity();
        }
        catch(error) {
            this.error("onSettings error: "+ error.message);
        }
    }
}

module.exports = SwitchDevice;