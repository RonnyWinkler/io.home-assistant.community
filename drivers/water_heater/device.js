'use strict';

const BaseDevice = require('../basedevice');

class WaterHeaterDevice extends BaseDevice {

    async onInit() {
        await super.onInit();

        // mode lists
        this.modesOperation = [];

        this.registerCapabilityListener('onoff', async (value) => {
            await this._onCapabilityOnoff(value);
        });
        this.registerCapabilityListener('target_temperature', async (value) => {
            await this._onCapabilityTargetTemperature(value);
        });
        this.registerCapabilityListener('water_heater_away_mode', async (value) => {
            await this._onCapabilityAwayMode(value);
        });
        this.registerCapabilityListener('water_heater_mode', async (value) => {
            await this._onCapabilityMode(value);
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
        try{
            if(data && data.entity_id && this.entityId == data.entity_id) {
                // if (data.state != undefined && 
                //     data.state != "unavailable"){
                //     await this.setCapabilityValue("water_heater_state", data.state);
                // }
                if (data.state != undefined ){ 
                    if (data.state == 'off'){
                        await this.setCapabilityValue("onoff", false);
                    }
                    if (data.state == 'on'){
                        await this.setCapabilityValue("onoff", true);
                    }
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
                if (this.hasCapability("water_heater_away_mode") && 
                    data.attributes.away_mode != undefined &&
                    data.attributes.away_mode != "unavailable"){
                    await this.setCapabilityValue("water_heater_away_mode", data.attributes.away_mode);
                }
                try{
                    if (this.hasCapability("water_heater_mode") && 
                        data.attributes.operation_mode != undefined &&
                        data.attributes.operation_mode != "unavailable"){
                        await this.setCapabilityValue("water_heater_mode", data.attributes.operation_mode);
                    }
                }
                catch(error){
                    this.error("Error changing capability: "+error.message);
                }

                // update mode lists
                if ( data.attributes.operation_list != undefined ){
                    this.modesOperation = data.attributes.operation_list;
                }
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
            await this._client.callService("water_heater", "turn_on", {"entity_id": entityId});
        }
        else{
            await this._client.callService("water_heater", "turn_off", {"entity_id": entityId});
        }
    }

    async _onCapabilityAwayMode( value ) {
        let entityId = this.entityId;
        await this._client.callService("water_heater", "set_away_mode", {"entity_id": entityId, "away_mode": value});
    }

    async _onCapabilityMode( value ) {
        let entityId = this.entityId;
        await this._client.callService("water_heater", "set_operation_mode", {"entity_id": entityId, "operation_mode": value});
    }

    async _onCapabilityTargetTemperature( value ) {
        let entityId = this.entityId;
        await this._client.callService("water_heater", "set_temperature", {
            "entity_id": entityId,
            "temperature": value
        });
    }

    // Autocomplete lists & flow actions ===================================================================================?
    async setOperationMode(mode){
        if (this.hasCapability("water_heater_mode")){
            await this._onCapabilityMode( mode );
        }
        else{
            throw new Error("Operations mode not supported");
        }
    }

    getModesOperationList(){
        try{
            let result = [];
            for (let i=0; i<this.modesOperation.length; i++){
                result.push({
                    id: this.modesOperation[i],
                    name: this.modesOperation[i]
                });
            }
            return result;
        }
        catch(error){
            this.error("Error reading operation mode list: "+error.message);
        }   
    }

    async setAwayMode(mode){
        if (this.hasCapability("water_heater_away_mode")){
            await this._onCapabilityAwayMode( mode );
        }
        else{
            throw new Error("Away mode not supported");
        }
    }

}

module.exports = WaterHeaterDevice;