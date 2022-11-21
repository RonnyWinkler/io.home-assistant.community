'use strict';

const BaseDevice = require('../basedevice');

class CoverDevice extends BaseDevice {

    async onInit() {
        await super.onInit();

        this.registerCapabilityListener('windowcoverings_closed', async (value) => {
            await this._onCapabilityWindowcoveringsClosed(value);
        });
        this.registerCapabilityListener('windowcoverings_state', async (value) => {
            await this._onCapabilityWindowcoveringsState(value);
        });
        this.registerCapabilityListener('windowcoverings_set', async (value) => {
            await this._onCapabilityWindowcoveringsSet(value);
        });
        this.registerCapabilityListener('windowcoverings_tilt_up', async (value) => {
            await this._onCapabilityWindowcoveringsTiltUp(value);
        });
        this.registerCapabilityListener('windowcoverings_tilt_down', async (value) => {
            await this._onCapabilityWindowcoveringsTiltDown(value);
        });
        this.registerCapabilityListener('windowcoverings_tilt_set', async (value) => {
            await this._onCapabilityWindowcoveringsTiltSet(value);
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
                if (this.hasCapability("windowcoverings_closed")){
                    if (data.state == "open"){
                        await this.setCapabilityValue("windowcoverings_closed", false);
                        if (this.hasCapability("windowcoverings_set")){
                            await this.setCapabilityValue("windowcoverings_set", 1);
                        }
                    }
                    if (data.state == "closed"){
                        await this.setCapabilityValue("windowcoverings_closed", true);
                        if (this.hasCapability("windowcoverings_set")){
                            await this.setCapabilityValue("windowcoverings_set", 0);
                        }
                    }
                }
                if (this.hasCapability("windowcoverings_set")){
                    if (data.attributes.current_position != undefined){
                        let value = data.attributes.current_position/100;
                        await this.setCapabilityValue("windowcoverings_set", value );
                    }
                }
                if (this.hasCapability("windowcoverings_tilt_set")){
                    if (data.attributes.current_tilt_position != undefined){
                        let value = data.attributes.current_tilt_position/100;
                        await this.setCapabilityValue("windowcoverings_tilt_set", value );
                    }
                }
            }
        }
        catch(error){
            this.error("Error adding capability: "+error.message);
        }
    }

    // Capabilities ===========================================================================================
    async _onCapabilityWindowcoveringsClosed(value){
        this.log("Cover closed: "+value);
        let entityId = this.entityId;
        if (value){
            await this._client.callService("cover", "close_cover", {
                "entity_id": entityId
            });
        }
        else{
            await this._client.callService("cover", "open_cover", {
                "entity_id": entityId
            });
        }
        return true;
    }
    async _onCapabilityWindowcoveringsState(value){
        this.log("Cover state: "+value);
        let entityId = this.entityId;
        switch (value){
            case 'idle': 
                await this._client.callService("cover", "stop_cover", {
                    "entity_id": entityId
                });
                break;
            case 'up': 
                await this._client.callService("cover", "open_cover", {
                    "entity_id": entityId
                });
                break;
            case 'down': 
                await this._client.callService("cover", "close_cover", {
                    "entity_id": entityId
                });
                break;
        }
    }
    async _onCapabilityWindowcoveringsSet(value){
        this.log("Cover set: "+value);
        let entityId = this.entityId;
        let position = value * 100;
        if (position < 0){ position = 0;}
        if (position > 100){ position = 100;}
        await this._client.callService("cover", "set_cover_position", {
            "entity_id": entityId,
            "position": position
        });

    }
    async _onCapabilityWindowcoveringsTiltUp(value){
        this.log("Cover tilt up: "+value);
        let entityId = this.entityId;
        await this._client.callService("cover", "set_cover_tilt_position", {
            "entity_id": entityId,
            "tilt_position": 100
        });
    }
    async _onCapabilityWindowcoveringsTiltDown(value){
        this.log("Cover tilt down: "+value);
        let entityId = this.entityId;
        await this._client.callService("cover", "set_cover_tilt_position", {
            "entity_id": entityId,
            "tilt_position": 0
        });
    }
    async _onCapabilityWindowcoveringsTiltSet(value){
        this.log("Cover tilt set: "+value);
        let entityId = this.entityId;
        let position = value * 100;
        if (position < 0){ position = 0;}
        if (position > 100){ position = 100;}
        await this._client.callService("cover", "set_cover_tilt_position", {
            "entity_id": entityId,
            "tilt_position": position
        });
    }

}

module.exports = CoverDevice;