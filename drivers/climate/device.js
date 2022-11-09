'use strict';

const Homey = require('homey');

class ClimateDevice extends Homey.Device {

    async onInit() {
        await this.updateCapabilities();

        this._client = this.homey.app.getClient();

        this.entityId = this.getData().id;

        this.log('Device init. ID: '+this.entityId+" Name: "+this.getName()+" Class: "+this.getClass());

        this._client.registerDevice(this.entityId, this);

        this.registerCapabilityListener('target_temperature', async (value, opts) => {
            await this.onCapabilityTargetTemperature(value, opts);
        });
        this.registerCapabilityListener('climate_mode', async (value, opts) => {
            await this.onCapabilityClimateMode(value, opts);
        });
        this.registerCapabilityListener('climate_mode_fan', async (value, opts) => {
            await this.onCapabilityClimateModeFan(value, opts);
        });
        this.registerCapabilityListener('climate_mode_preset', async (value, opts) => {
            await this.onCapabilityClimateModePreset(value, opts);
        });
        this.registerCapabilityListener('climate_mode_swing', async (value, opts) => {
            await this.onCapabilityClimateModeSwing(value, opts);
        });
        
        // maintenance actions
        this.registerCapabilityListener('button.reconnect', async () => {
            await this.clientReconnect()
        });

        // Init device with a short timeout to wait for initial entities
        this.timeoutInitDevice = this.homey.setTimeout(async () => this.onInitDevice().catch(e => console.log(e)), 5 * 1000 );

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

    onAdded() {
        this.log('device added');
    }

    onDeleted() {
        this.log('device deleted');
        this._client.unregisterDevice(this.entityId);
    }

    async onInitDevice(){
        // Init device on satrtup with latest data to have initial values before HA sends updates
        this.homey.clearTimeout(this.timeoutInitDevice);
        this.timeoutInitDevice = null;

        this.log('Device init data. ID: '+this.entityId+" Name: "+this.getName()+" Class: "+this.getClass());
        let entity = this._client.getEntity(this.entityId);
        if (entity){
            this.onEntityUpdate(entity);
        }
    }

    async onCapabilityClimateMode( value, opts ) {
        // switch (value){
        //     // check features:
        //     // TARGET_HUMIDITY = 4
        //     // FAN_MODE = 8
        //     case "dry":
        //         if ((this.getStoreValue("features") & 4) != 4) {
        //             throw new Error("Mode not supported.");
        //         }
        //         break;
        //     case "fan_only":
        //         if ((this.getStoreValue("features") & 8) != 8) {
        //             throw new Error("Mode not supported.");
        //         }
        //         break;
        // }
        let entityId = this.entityId;
        await this._client.callService("climate", "set_hvac_mode", {
            "entity_id": entityId,
            "hvac_mode": value
        });
    }

    async onCapabilityClimateModeFan( value, opts ) {
        let entityId = this.entityId;
        await this._client.callService("climate", "set_fan_mode", {
            "entity_id": entityId,
            "fan_mode": value
        });
    }

    async onCapabilityClimateModePreset( value, opts ) {
        let entityId = this.entityId;
        await this._client.callService("climate", "set_preset_mode", {
            "entity_id": entityId,
            "preset_mode": value
        });
    }

    async onCapabilityClimateModeSwing( value, opts ) {
        let entityId = this.entityId;
        await this._client.callService("climate", "set_swing_mode", {
            "entity_id": entityId,
            "swing_mode": value
        });
    }

    async onCapabilityTargetTemperature( value, opts ) {
        let entityId = this.entityId;
        await this._client.callService("climate", "set_temperature", {
            "entity_id": entityId,
            "temperature": value
        });
    }

    async onEntityUpdate(data) {
        try{
            if(data) {
                if (data.state != undefined && data.state != "unavailable"){
                    await this.setCapabilityValue("climate_mode", data.state);
                }
                if (data.attributes.current_temperature != undefined){
                    await this.setCapabilityValue("measure_temperature", data.attributes.current_temperature);
                }
                if (this.hasCapability("target_temperature") && data.attributes.temperature != undefined){
                    await this.setCapabilityValue("target_temperature", data.attributes.temperature);
                }
                if (this.hasCapability("measure_humidity") && 
                    data.attributes.current_humidity != undefined &&
                    data.attributes.current_humidity != "off"){
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
        }
        catch(error){
            this.error("Error changing capability: "+error.message);
        }
    }

    async clientReconnect(){
        await this.homey.app.clientReconnect();
    }
    
    async onDeleted() {
        this.driver.tryRemoveIcon(this.getData().id);
        
        if (this.timeoutInitDevice){
            this.homey.clearTimeout(this.timeoutInitDevice);
            this.timeoutInitDevice = null;    
        }
    }
}

module.exports = ClimateDevice;