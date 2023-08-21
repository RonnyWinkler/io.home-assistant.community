'use strict';

const BaseDevice = require('../basedevice');

class ClimateFanDevice extends BaseDevice {

    async onInit() {
        this._settings = this.getSettings();
        await super.onInit();

        // climate mode lists
        this.modesFan = [];
        this.modesPreset = [];
        this.modesSwing = [];
        // fan mode lists
        this.modesFanSpeed = [];
        this.modesFanPreset = [];

        // Climate:
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
        // Fan:
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

    // Redefinitionen ============================================================================================
    clientRegisterDevice(){
        let entityIds = this.getStoreValue("entities");
        if (entityIds.length > 0){
            this._client.registerCompound(this.entityId, this, entityIds);
        }
    }

    clientUnregisterDevice(){
        this._client.unregisterCompound(this.entityId);
    }
    
    async onInitDevice(){
        await super.onInitDevice();

        let entityIds = this.getStoreValue("entities");
        for (let i=0; i<entityIds.length; i++){
            let entity = this._client.getEntity(entityIds[i]);
            if (entity){
                this.log('Device init data. Sub-ID: '+entityIds[i]);
                this.onEntityUpdate(entity);
            }
        }
    }

    async checkDeviceAvailability(){
        let client = this.getClient();
        if (client != undefined && this.entityId != undefined){
            let entity_fan = this._client.getEntity("fan."+this.entityId.split(".")[1]);
            let entity_climate = this._client.getEntity("climate."+this.entityId.split(".")[1]);
            if (entity_fan == null || entity_climate == null){
                await this.setUnavailable(this.homey.__("device_unavailable_reason.entity_not_found"));
            }
            else{
                // this.setAvailable();
                this.onEntityUpdate(entity_fan);
                this.onEntityUpdate(entity_climate);
            }
        }
    }

    // Entity update ============================================================================================
    async onEntityUpdate(data) {
        await super.onEntityUpdate(data);
        try{
            if(data && (
                data.entity_id == ("fan."+this.entityId.split(".")[1]) ||
                data.entity_id == ("climate."+this.entityId.split(".")[1])
                )
            ){
                if (data.entity_id.startsWith("climate.")){
                    // Climate capabilities:
                    let ha_units = {};
                    try{
                        ha_units = this.getClient().getConfig().unit_system;
                    }
                    catch(error){ ha_units = {} }
    
                    if (data.state != undefined && 
                        data.state != "unavailable"){
                        await this.setCapabilityValue("climate_mode", data.state);
                    }
                    if (data.attributes.current_temperature != undefined && 
                        data.attributes.current_temperature != "unavailable"){
                        let temp = data.attributes.current_temperature;
                        if (ha_units.temperature == '°F'){
                            temp = (temp - 32) * 5/9;
                        }
                        await this.setCapabilityValue("measure_temperature", temp);
                    }
                    if (this.hasCapability("target_temperature") && 
                        data.attributes.temperature != undefined &&
                        data.attributes.temperature != "unavailable"){
                        let temp = data.attributes.temperature;
                        if (ha_units.temperature == '°F'){
                            temp = (temp - 32) * 5/9;
                        }
                        await this.setCapabilityValue("target_temperature", temp);
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
                }
                // update climate mode lists
                if ( data.attributes.fan_modes != undefined ){
                    this.modesFan = data.attributes.fan_modes;
                }
                if ( data.attributes.preset_modes != undefined ){
                    this.modesPreset = data.attributes.preset_modes;
                }
                if ( data.attributes.swing_modes != undefined ){
                    this.modesSwing = data.attributes.swing_modes;
                }

                if (data.entity_id.startsWith("fan.")){
                    // Fan capabilities
                    if (data.state != undefined && 
                        data.state != "unavailable" &&
                        data.state == "on"){
                        await this.setCapabilityValue("onoff", true);
                    }
                    if (data.state != undefined && 
                        data.state != "unavailable" &&
                        data.state == "off"){
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
                    // update fan mode lists
                    if ( data.attributes.preset_modes != undefined ){
                        this.modesFanPreset = data.attributes.preset_modes;
                    }
                    if ( data.attributes.speed_list != undefined ){
                        this.modesFanSpeed = data.attributes.speed_list;
                    }
                }
            }
        }
        catch(error){
            this.error("Error changing capability: "+error.message);
        }
    }

    // Capabilities ===========================================================================================?
    // Climate capabilities
     async _onCapabilityClimateMode( value ) {
        let entityIds = this.getStoreValue("entities");
        let entityId = entityIds.filter((result) => { 
            return ( result.startsWith("climate."))
        });
        await this._client.callService("climate", "set_hvac_mode", {
            "entity_id": entityId,
            "hvac_mode": value
        });
        return true;
    }

    async _onCapabilityClimateModeFan( value ) {
        let entityIds = this.getStoreValue("entities");
        let entityId = entityIds.filter((result) => { 
            return ( result.startsWith("climate."))
        });
        await this._client.callService("climate", "set_fan_mode", {
            "entity_id": entityId,
            "fan_mode": value
        });
    }

    async _onCapabilityClimateModePreset( value ) {
        let entityIds = this.getStoreValue("entities");
        let entityId = entityIds.filter((result) => { 
            return ( result.startsWith("climate."))
        });
        await this._client.callService("climate", "set_preset_mode", {
            "entity_id": entityId,
            "preset_mode": value
        });
    }

    async _onCapabilityClimateModeSwing( value ) {
        let entityIds = this.getStoreValue("entities");
        let entityId = entityIds.filter((result) => { 
            return ( result.startsWith("climate."))
        });
        await this._client.callService("climate", "set_swing_mode", {
            "entity_id": entityId,
            "swing_mode": value
        });
    }

    async _onCapabilityTargetTemperature( value ) {
        let entityIds = this.getStoreValue("entities");
        let entityId = entityIds.filter((result) => { 
            return ( result.startsWith("climate."))
        });
        await this._client.callService("climate", "set_temperature", {
            "entity_id": entityId,
            "temperature": value
        });
    }

    // Fan capabilities:
    async _onCapabilityOnoff( value ) {
        let entityIds = this.getStoreValue("entities");
        let entityId = entityIds.filter((result) => { 
            return ( result.startsWith("fan."))
        });
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
        let entityIds = this.getStoreValue("entities");
        let entityId = entityIds.filter((result) => { 
            return ( result.startsWith("fan."))
        });
        await this._client.callService("fan", "oscillate", {
            "entity_id": entityId,
            "oscillating": value
        });
        return true;
    }

    async _onCapabilityOnoffReverse( value ) {
        let entityIds = this.getStoreValue("entities");
        let entityId = entityIds.filter((result) => { 
            return ( result.startsWith("fan."))
        });
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
        let entityIds = this.getStoreValue("entities");
        let entityId = entityIds.filter((result) => { 
            return ( result.startsWith("fan."))
        });
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


    // Autocomplete lists & flow actions ===================================================================================?
    // Climate:
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
            result.push({id: "id1", name: "name1"});
            return result;
        }
        catch(error){
            this.error("Error reading swing list: "+error.message);
        }   
    }

    async setModeSwing(mode){
        await this._onCapabilityClimateModeSwing( mode );
    }

    // Fan:
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

module.exports = ClimateFanDevice;