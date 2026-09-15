'use strict';

const BaseDevice = require('../basedevice');

class ClimateDevice extends BaseDevice {

    async onInit() {
        this._settings = this.getSettings();
        await super.onInit();

        if (!this.hasCapability("target_temperature.high")){
            await this.addCapability("target_temperature.high");
        }
        if (!this.hasCapability("target_temperature.low")){
            await this.addCapability("target_temperature.low");
        }
        if (!this.hasCapability("measure_temperature.high")){
            await this.addCapability("measure_temperature.high");
        }
        if (!this.hasCapability("measure_temperature.low")){
            await this.addCapability("measure_temperature.low");
        }

        // mode lists
        this.modesHvac = [];
        this.modesFan = [];
        this.modesPreset = [];
        this.modesSwing = [];

        this.registerCapabilityListener('target_temperature', async (value, opts) => {
            await this._onCapabilityTargetTemperature(value);
        });
        this.registerCapabilityListener('target_temperature.high', async (value, opts) => {
            await this._onCapabilityTargetTemperatureHigh(value);
        });
        this.registerCapabilityListener('target_temperature.low', async (value, opts) => {
            await this._onCapabilityTargetTemperatureLow(value);
        });
        this.registerCapabilityListener('climate_mode', async (value, opts) => {
            await this._onCapabilityClimateMode(value);
        });
        this.registerCapabilityListener('climate_mode_fan', async (value, opts) => {
            await this._onCapabilityClimateModeFan(value);
        });
        this.registerCapabilityListener('climate_mode_preset', async (value, opts) => {
            await this._onCapabilityClimateModePreset(value);
        });
        this.registerCapabilityListener('climate_mode_swing', async (value, opts) => {
            await this._onCapabilityClimateModeSwing(value);
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
            if (!this.hasCapability('climate_on')){
                await this.addCapability('climate_on');
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
                let entityId = "climate." + this.entityId.split('.')[1] + "_power"; 
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
        try{
            if(data && data.entity_id && this.entityId == data.entity_id) {
                let ha_units = {};
                try{
                    ha_units = this.getClient().getConfig().unit_system;
                }
                catch(error){ ha_units = {} }

                if (data.state != undefined ){ 
                    if (data.state == "unavailable" || data.state == 'off'){
                        await this.setCapabilityValue("climate_on", false);
                    }
                    else{
                        await this.setCapabilityValue("climate_on", true);
                    }

                }
                if (data.attributes.current_temperature != undefined && 
                    data.attributes.current_temperature != "unavailable"){
                    let temp = data.attributes.current_temperature;
                    if (ha_units.temperature == '°F'){
                        temp = (temp - 32) * 5/9;
                    }
                    await this.setCapabilityValue("measure_temperature", temp);
                    await this.setCapabilityValue("measure_temperature.high", temp);
                    await this.setCapabilityValue("measure_temperature.low", temp);
                }

                if (data.state != undefined && data.state != this.getStoreValue("last_state")){
                    this.setStoreValue("last_state", data.state);
                    if (data.state == "heat_cool"){
                        // activate high/low target temperatures
                        this.setCapabilityOptions("target_temperature.high", { uiComponent: "thermostat" });
                        this.setCapabilityOptions("target_temperature.low", { uiComponent: "thermostat" });
                        this.setCapabilityOptions("measure_temperature.high", { uiComponent: "thermostat" });
                        this.setCapabilityOptions("measure_temperature.low", { uiComponent: "thermostat" });
                        this.setCapabilityOptions("target_temperature", { uiComponent: null });
                    }
                    else{
                        // deactivate high/low target temperatures
                        this.setCapabilityOptions("target_temperature.high", { uiComponent: null });
                        this.setCapabilityOptions("target_temperature.low", { uiComponent: null });
                        this.setCapabilityOptions("measure_temperature.high", { uiComponent: null });
                        this.setCapabilityOptions("measure_temperature.low", { uiComponent: null });
                        this.setCapabilityOptions("target_temperature", { uiComponent: "thermostat" });
                    }
                }

                if (this.hasCapability("target_temperature")){
                    if(data.attributes.temperature != undefined &&
                        data.attributes.temperature != "unavailable"){
                        let temp = data.attributes.temperature;
                        if (ha_units.temperature == '°F'){
                            temp = (temp - 32) * 5/9;
                        }
                        await this.setCapabilityValue("target_temperature", temp);
                    }
                    else{
                        await this.setCapabilityValue("target_temperature", null);
                    }
                }
                if (this.hasCapability("target_temperature.high")){ 
                    if (data.attributes.target_temp_high != undefined &&
                        data.attributes.target_temp_high != "unavailable"){
                        let temp = data.attributes.target_temp_high;
                        if (ha_units.temperature == '°F'){
                            temp = (temp - 32) * 5/9;
                        }
                        await this.setCapabilityValue("target_temperature.high", temp);
                    }
                    else{
                        await this.setCapabilityValue("target_temperature.high", null);
                    }
                }
                if (this.hasCapability("target_temperature.low")){ 
                    if (data.attributes.target_temp_low != undefined &&
                        data.attributes.target_temp_low != "unavailable"){
                        let temp = data.attributes.target_temp_low;
                        if (ha_units.temperature == '°F'){
                            temp = (temp - 32) * 5/9;
                        }
                        await this.setCapabilityValue("target_temperature.low", temp);
                    }
                    else{
                        await this.setCapabilityValue("target_temperature.low", null);
                    }
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

                // update mode lists
                if ( data.attributes.hvac_modes != undefined && data.attributes.hvac_modes != this.modesHvac){
                    this.modesHvac = data.attributes.hvac_modes;
                    await this.setCapabilityEnumList('climate_mode', data.attributes.hvac_modes);
                }

                if ( data.attributes.fan_modes != undefined && data.attributes.fan_modes != this.modesFan){
                    this.modesFan = data.attributes.fan_modes;
                    await this.setCapabilityEnumList('climate_mode_fan', data.attributes.fan_modes);
                }
                if ( data.attributes.preset_modes != undefined && data.attributes.preset_modes != this.modesPreset){
                    this.modesPreset = data.attributes.preset_modes;
                    await this.setCapabilityEnumList('climate_mode_preset', data.attributes.preset_modes);
                }
                if ( data.attributes.swing_modes != undefined && data.attributes.swing_modes != this.modesSwing){
                    this.modesSwing = data.attributes.swing_modes;
                    await this.setCapabilityEnumList('climate_mode_swing', data.attributes.swing_modes);
                }

                // update modes
                if (data.state != undefined && 
                    data.state != "unavailable"){
                    try{
                        await this.setCapabilityValue("climate_mode", data.state);
                    }
                    catch(error){ }
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

                // Update capability options
                if (    
                    data.attributes.min_temp != this.getCapabilityOptions("target_temperature").min ||
                    data.attributes.min_temp != this.getCapabilityOptions("target_temperature.min").min ||
                    data.attributes.min_temp != this.getCapabilityOptions("target_temperature.max").min ||
                    data.attributes.max_max != this.getCapabilityOptions("target_temperature").max ||
                    data.attributes.max_max != this.getCapabilityOptions("target_temperature.min").max ||
                    data.attributes.max_max != this.getCapabilityOptions("target_temperature.max").max ||
                    data.attributes.target_temp_step != this.getCapabilityOptions("target_temperature").step ||
                    data.attributes.target_temp_step != this.getCapabilityOptions("target_temperature.min").step ||
                    data.attributes.target_temp_step != this.getCapabilityOptions("target_temperature.max").step
                ){
                    let min = data.attributes.min_temp;
                    let max = data.attributes.max_temp;
                    if (ha_units.temperature == '°F'){ 
                        min = (min - 32) * 5/9;
                        max = (max - 32) * 5/9;
                    }

                    this.setCapabilityOptions("target_temperature", {
                        "min": min,
                        "max": max,
                        "step": data.attributes.target_temp_step
                    });
                    this.setCapabilityOptions("target_temperature.min", {
                        "min": min,
                        "max": max,
                        "step": data.attributes.target_temp_step
                    });
                    this.setCapabilityOptions("target_temperature.max", {
                        "min": min,
                        "max": max,
                        "step": data.attributes.target_temp_step
                    });
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
        let ha_units = {};
        try{
            ha_units = this.getClient().getConfig().unit_system || {};
        }
        catch(error){ ha_units = {} }
        let temp = value;
        if (ha_units.temperature == '°F'){
            temp = temp * 9/5 + 32;
        }
        await this._client.callService("climate", "set_temperature", {
            "entity_id": entityId,
            "temperature": temp
        });
    }

    async _onCapabilityTargetTemperatureHigh( value ) {
        let entityId = this.entityId;
        let temp_high =  value;
        let temp_low = this.getCapabilityValue("target_temperature.low");
        let ha_units = {};
        try{
            ha_units = this.getClient().getConfig().unit_system || {};
        }
        catch(error){ ha_units = {} }
        if (temp_high == undefined || temp_low == undefined){ return; }
        if (ha_units.temperature == '°F'){
            temp_high = temp_high * 9/5 + 32;
            temp_low = temp_low * 9/5 + 32;
        }
        await this._client.callService("climate", "set_temperature", {
            "entity_id": entityId,
            "target_temp_high": temp_high,
            "target_temp_low": temp_low
        });
    }

    async _onCapabilityTargetTemperatureLow( value ) {
        let entityId = this.entityId;
        let temp_high = this.getCapabilityValue("target_temperature.high");
        let temp_low = value;
        let ha_units = {};
        try{
            ha_units = this.getClient().getConfig().unit_system || {};
        }
        catch(error){ ha_units = {} }
        if (temp_high == undefined || temp_low == undefined){ return; }
        if (ha_units.temperature == '°F'){
            temp_high = temp_high * 9/5 + 32;
            temp_low = temp_low * 9/5 + 32;
        }
        await this._client.callService("climate", "set_temperature", {
            "entity_id": entityId,
            "target_temp_high": temp_high,
            "target_temp_low": temp_low
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

module.exports = ClimateDevice;