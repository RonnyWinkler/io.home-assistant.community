'use strict';

const BaseDevice = require('../basedevice');

class FanDevice extends BaseDevice {

    async onInit() {
        await super.onInit();

        // mode lists
        this.modesSpeed = [];
        this.modesPreset = [];

        this.registerCapabilityListener('onoff', async (value) => {
            await this._onCapabilityOnoff(value);
        });
        this.registerCapabilityListener('dim', async (value) => {
            await this._onCapabilityDim(value);
        });
        this.registerCapabilityListener('fan_oscillate', async (value) => {
            await this._onCapabilityOnoffOscillate(value);
        });
        this.registerCapabilityListener('fan_reverse', async (value) => {
            await this._onCapabilityOnoffReverse(value);
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
            if(data) {
                if (data.state != undefined && 
                    data.state != "unavailable" &&
                    data.state == "on"){
                    await this.setCapabilityValue("onoff", true);
                }
                else{
                    await this.setCapabilityValue("onoff", false);
                }
                if (data.attributes.percentage != undefined && 
                    data.attributes.percentage != "unavailable"){
                    let dim = data.attributes.percentage / 100;
                    await this.setCapabilityValue("dim", dim);
                }
                if (data.attributes.oscillating != undefined && 
                    data.attributes.oscillating != "unavailable"){
                    await this.setCapabilityValue("fan_oscillate", data.attributes.oscillating);
                }
                if (data.attributes.direction != undefined && 
                    data.attributes.direction != "unavailable"){
                    if(data.attributes.direction == "forward"){
                        await this.setCapabilityValue("fan_reverse", false);
                    }
                    else{
                        await this.setCapabilityValue("fan_reverse", true);
                    }
                }

                this.modesPreset = data.attributes.preset_modes;
                this.modesSpeed = data.attributes.speed_list;

            }
        }
        catch(error){
            this.error("Error changing capability: "+error.message);
        }
    }

     // Capabilities ===========================================================================================?
     async _onCapabilityOnoff( value ) {
        let entityId = this.entityId;
        if (value){
            await this._client.callService("fan", "turn_on", {
                "entity_id": entityId
            });
        }
        else{
            await this._client.callService("fan", "turn_off", {
                "entity_id": entityId
            });
        }
        return true;
    }

    async _onCapabilityOnoffOscillate( value ) {
        let entityId = this.entityId;
        await this._client.callService("fan", "oscillate", {
            "entity_id": entityId,
            "oscillating": value
        });
        return true;
    }

    async _onCapabilityOnoffReverse( value ) {
        let entityId = this.entityId;
        let direction = "forward";
        if (value){
            direction = "reverse";
        }
        await this._client.callService("fan", "set_direction", {
            "entity_id": entityId,
            "direction": direction
        });
        return true;
    }

    async _onCapabilityDim( value ) {
        let entityId = this.entityId;
        let speed = value * 100;
        if (speed > 100){
            speed = 100;
        } 
        if (speed < 0){
            speed = 0;
        } 
        await this._client.callService("fan", "set_percentage", {
            "entity_id": entityId,
            "percentage": value * 100
        });
        return true;
    }

    // flow actions ===================================================================================?
    async setOscillateOn(){
        await this._onCapabilityOnoffOscillate( true );
    }
    async setOscillateOff(){
        await this._onCapabilityOnoffOscillate( false );
    }
    async setReverseOn(){
        await this._onCapabilityOnoffReverse( true );
    }
    async setReverseOff(){
        await this._onCapabilityOnoffReverse( false );
    }

}

module.exports = FanDevice;