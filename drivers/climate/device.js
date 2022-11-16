'use strict';

const BaseDevice = require('../basedevice');

class ClimateDevice extends BaseDevice {

    async onInit() {
        await super.onInit();

        // mode lists
        this.modesFan = [];
        this.modesPreset = [];
        this.modesSwing = [];

        this.registerCapabilityListener('target_temperature', async (value) => {
            await this._onCapabilityTargetTemperature(value);
        });
        this.registerCapabilityListener('climate_mode', async (value) => {
            await this._onCapabilityClimateMode(value);
        });
        this.registerCapabilityListener('climate_mode_fan', async (value) => {
            await this._onCapabilityClimateModeFan(value, opts);
        });
        this.registerCapabilityListener('climate_mode_preset', async (value) => {
            await this._onCapabilityClimateModePreset(value, opts);
        });
        this.registerCapabilityListener('climate_mode_swing', async (value) => {
            await this._onCapabilityClimateModeSwing(value, opts);
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
                    data.state != "unavailable"){
                    await this.setCapabilityValue("climate_mode", data.state);
                }
                if (data.attributes.current_temperature != undefined && 
                    data.attributes.current_temperature != "unavailable"){
                    await this.setCapabilityValue("measure_temperature", data.attributes.current_temperature);
                }
                if (this.hasCapability("target_temperature") && 
                    data.attributes.temperature != undefined &&
                    data.attributes.temperature != "unavailable"){
                    await this.setCapabilityValue("target_temperature", data.attributes.temperature);
                }
                if (this.hasCapability("measure_humidity") && 
                    data.attributes.current_humidity != undefined &&
                    data.attributes.current_humidity != "off" &&
                    data.attributes.current_humidity != "unavailable"){
                    await this.setCapabilityValue("measure_humidity", data.attributes.current_humidity);
                }
                if (this.hasCapability("climate_action") && 
                    data.attributes.hvac_action != undefined){
                    await this.setCapabilityValue("climate_action", data.attributes.hvac_action);
                }
                if (this.hasCapability("climate_mode_fan") && 
                    data.attributes.fan_mode != undefined &&
                    data.attributes.fan_mode != "unavailable"){
                    await this.setCapabilityValue("climate_mode_fan", data.attributes.fan_mode);
                }
                if (this.hasCapability("climate_mode_preset") && 
                    data.attributes.preset_mode != undefined &&
                    data.attributes.preset_mode != "unavailable"){
                    await this.setCapabilityValue("climate_mode_preset", data.attributes.preset_mode);
                }
                if (this.hasCapability("climate_mode_swing") && 
                    data.attributes.swing_mode != undefined &&
                    data.attributes.swing_mode != "unavailable"){
                    await this.setCapabilityValue("climate_mode_swing", data.attributes.preset_swing);
                }

                // update mode lists
                if ( data.attributes.fan_modes != undefined ){
                    this.modesFan = data.attributes.fan_modes;
                }
                if ( data.attributes.preset_modes != undefined ){
                    this.modesPreset = data.attributes.preset_modes;
                }
                if ( data.attributes.swing_modes != undefined ){
                    this.modesSwing = data.attributes.swing_modes;
                }
            }
        }
        catch(error){
            this.error("Error changing capability: "+error.message);
        }
    }

     // Capabilities ===========================================================================================?
     async _onCapabilityClimateMode( value ) {
        let entityId = this.entityId;
        // await this.setCapabilityValue("climate_mode", value);
        await this._client.callService("climate", "set_hvac_mode", {
            "entity_id": entityId,
            "hvac_mode": value
        });
        return true;
    }

    async _onCapabilityClimateModeFan( value ) {
        let entityId = this.entityId;
        await this._client.callService("climate", "set_fan_mode", {
            "entity_id": entityId,
            "fan_mode": value
        });
    }

    async _onCapabilityClimateModePreset( value ) {
        let entityId = this.entityId;
        await this._client.callService("climate", "set_preset_mode", {
            "entity_id": entityId,
            "preset_mode": value
        });
    }

    async _onCapabilityClimateModeSwing( value ) {
        let entityId = this.entityId;
        await this._client.callService("climate", "set_swing_mode", {
            "entity_id": entityId,
            "swing_mode": value
        });
    }

    async _onCapabilityTargetTemperature( value ) {
        let entityId = this.entityId;
        await this._client.callService("climate", "set_temperature", {
            "entity_id": entityId,
            "temperature": value
        });
    }

    // Autocomplete lists & flow actions ===================================================================================?
    async setMode(mode){
        await this._onCapabilityClimateMode( mode );
    }

    getModesFanList(){
        try{
            let result = [];
            for (let i=0; i<this.modesFan.length; i++){
                result.push({
                    id: this.modesFan[i],
                    name: this.modesFan[i]
                });
            }
            return result;
        }
        catch(error){
            this.error("Error reading fan list: "+error.message);
        }   
    }

    async setModeFan(mode){
        await this._onCapabilityClimateModeFan( mode );
    }

    getModesPresetList(){
        try{
            let result = [];
            for (let i=0; i<this.modesPreset.length; i++){
                result.push({
                    id: this.modesPreset[i],
                    name: this.modesPreset[i]
                });
            }
            return result;
        }
        catch(error){
            this.error("Error reading preset list: "+error.message);
        }   
    }

    async setModePreset(mode){
        await this._onCapabilityClimateModePreset( mode );
    }

    getModesSwingList(){
        try{
            let result = [];
            for (let i=0; i<this.modesSwing.length; i++){
                result.push({
                    id: this.modesSwing[i],
                    name: this.modesSwing[i]
                });
            }
            return result;
        }
        catch(error){
            this.error("Error reading swing list: "+error.message);
        }   
    }

    async setModeSwing(mode){
        await this._onCapabilityClimateModeSwing( mode );
    }

}

module.exports = ClimateDevice;