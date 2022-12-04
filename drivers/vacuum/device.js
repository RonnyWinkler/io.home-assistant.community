'use strict';

const BaseDevice = require('../basedevice');

class VacuumDevice extends BaseDevice {

    async onInit() {
        await super.onInit();

        // mode lists
        this.modesSpeed = [];

        this.registerCapabilityListener('onoff', async (value) => {
            await this._onCapabilityOnoff(value);
        });
        this.registerCapabilityListener('dim', async (value) => {
            await this._onCapabilityDim(value);
        });
        this.registerCapabilityListener('vacuum_start', async () => {
            await this._onCapabilityService('start');
        });
        this.registerCapabilityListener('vacuum_stop', async () => {
            await this._onCapabilityService('stop');
        });
        this.registerCapabilityListener('vacuum_pause', async () => {
            await this._onCapabilityService('pause');
        });
        this.registerCapabilityListener('vacuum_locate', async () => {
            await this._onCapabilityService('locate');
        });
        this.registerCapabilityListener('vacuum_return', async () => {
            await this._onCapabilityService('return_to_base');
        });
        this.registerCapabilityListener('vacuum_clean_spot', async () => {
            await this._onCapabilityService('clean_spot');
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
            if (!this.hasCapability('vacuum_state'))
            {
                await this.addCapability('vacuum_state');
            }
        }
        catch(error){
            this.error("Error adding capability: "+error.message);
        }
    }

    // Entity update ============================================================================================
    // States:
    // STATE_CLEANING = "cleaning"
    // STATE_DOCKED = "docked"
    // STATE_RETURNING = "returning"
    // STATE_ERROR = "error"

    async onEntityUpdate(data) {
        try{
            if(data) {
                if (this.hasCapability('vacuum_state')){
                    if (data.state != undefined && 
                        data.state != "unavailable"){
                        await this.setCapabilityValue("vacuum_state", data.state);
                    }
                }
                if (this.hasCapability('onoff')){
                    if (data.state != undefined && 
                        data.state == "cleaning"){
                        await this.setCapabilityValue("onoff", true);
                    }
                    else{
                        await this.setCapabilityValue("onoff", false);
                    }
                }
                if (this.hasCapability('dim')){
                    if (data.attributes.fan_speed != undefined && 
                        data.attributes.fan_speed != "unavailable"){
                        let dim = data.attributes.fan_speed / 100;
                        await this.setCapabilityValue("dim", dim);
                    }
                    else{
                        await this.setCapabilityValue("dim", 0);
                    }
                }
                if (this.hasCapability('measure_battery')){
                    if (data.attributes.battery_level != undefined && 
                        data.attributes.battery_level != "unavailable"){
                        await this.setCapabilityValue("measure_battery", data.attributes.battery_level);
                    }
                }
                this.modesSpeed = data.attributes.speed_list;
            }
        }
        catch(error){
            this.error("Error changing capability: "+error.message);
        }
    }

     // Capabilities ===========================================================================================?

     // Services:
    // SERVICE_CLEAN_SPOT = "clean_spot"
    // SERVICE_LOCATE = "locate"
    // SERVICE_RETURN_TO_BASE = "return_to_base"
    // SERVICE_SEND_COMMAND = "send_command"
    // SERVICE_SET_FAN_SPEED = "set_fan_speed"
    // SERVICE_START_PAUSE = "start_pause"
    // SERVICE_START = "start"
    // SERVICE_PAUSE = "pause"
    // SERVICE_STOP = "stop"

     async _onCapabilityOnoff( value ) {
        let entityId = this.entityId;
        if (value){
            await this._client.callService("vacuum", "turn_on", {
                "entity_id": entityId
            });
        }
        else{
            await this._client.callService("vacuum", "turn_off", {
                "entity_id": entityId
            });
        }
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
        await this._client.callService("vacuum", "set_fan_speed", {
            "entity_id": entityId,
            "fan_speed": speed
        });
        return true;
    }

    async _onCapabilityService(service) {
        let entityId = this.entityId;
        await this._client.callService("vacuum", service, {
            "entity_id": entityId
        });
        return true;
    }

    // flow actions ===================================================================================?
    async setFanSpeed(speed){
        let entityId = this.entityId;
        await this._client.callService("vacuum", "set_fan_speed", {
            "entity_id": entityId,
            "fan_speed": speed
        });
        return true;
    }

    getModesSpeedList(){
        try{
            let result = [];
            for (let i=0; i<this.modesSpeed.length; i++){
                result.push({
                    id: this.modesSpeed[i],
                    name: this.modesSpeed[i]
                });
            }
            return result;
        }
        catch(error){
            this.error("Error reading speed list: "+error.message);
        }   
    }
}

module.exports = VacuumDevice;