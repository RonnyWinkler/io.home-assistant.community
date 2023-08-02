'use strict';

const BaseDevice = require('../basedevice');

class CameraDevice extends BaseDevice {

    async onInit() {
        await super.onInit();

        this.mediaCover = null;
        this.mediaImage = await this.homey.images.createImage();
        await this.setCameraImage('entity_picture', '',  this.mediaImage);

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

    // getPowerEntityId(){
    //     try{
    //         let powerSetting = this._settings.power_entity; 
    //         if (this._settings.add_power_entity && powerSetting && powerSetting != "" ){
    //             return powerSetting;
    //         }
    //         else{
    //             let entityId = "sensor." + this.entityId.split('.')[1] + "_power"; 
    //             return entityId;
    //         }
    //     }
    //     catch(error){
    //         this.error("Error getting power entity ID for device "+this.entityId);
    //         return null;
    //     }
    // }

    // Entity update ============================================================================================
    async onEntityUpdate(data) {
        await super.onEntityUpdate(data);

        if(data && data.entity_id && data.entity_id == this.entityId) {
            switch (data.state){
                case "on":
                    if (this.hasCapability("onoff")){
                        await this.setCapabilityValue("onoff", true);
                    }
                    break;
                case "off":
                    if (this.hasCapability("onoff")){
                        await this.setCapabilityValue("onoff", false);
                    }
                    break;            
            }
            // await this.setCapabilityValue("onoff", data.state == "on");

            let entityPicture = null;
            if (   data.attributes.entity_picture != undefined &&
                        data.attributes.entity_picture != null){
                entityPicture = data.attributes.entity_picture;
            }
            if (entityPicture != null && entityPicture != undefined){
                if (this.mediaCover != entityPicture){
                    this.mediaCover = entityPicture;
                    let url = entityPicture;
                    if ( ! (entityPicture.startsWith("http")) ){
                        url =  this.homey.settings.get("address") + entityPicture;
                    }
                    if (url.startsWith('https')){
                        if (this.mediaImage){
                            this.mediaImage.setUrl(url);
                        }
                    }
                    else{
                        if (this.mediaImage){
                            this.mediaImage.setStream(async (stream) => {
                                return await this._upateCameraImage(stream);
                            });
                        }
                    }
                    await this.mediaImage.update();
                }
            }
            else{
                if (this.mediaCover != null){
                    this.mediaImage.setUrl(null);
                    await this.mediaImage.update();
                    this.mediaCover = null;
                }
            }

        }
    }

    // Capabilities ===========================================================================================
    async _onCapabilityOnoff( value, opts ) {
        await this._client.turnOnOff(this.entityId, value);
    }

    // Device functions ============================================================================================
    async _upateCameraImage(stream){
        if ( this.mediaCover == undefined || this.mediaCover == ""){
            throw new Error("No camera image available.");    
        }
        try{
            let url = this.mediaCover;
            if ( ! (this.mediaCover.startsWith("http")) ){
                url =  this.homey.settings.get("address") + this.mediaCover;
            }
            let res = await this.homey.app.httpGetStream(url);
            res.on("error", (error) => {this.log(error);});
            stream.on("error", (error) => {this.log(error);});
            return await res.pipe(stream);
        }
        catch(error){
            this.log("Error updating camera image: ", error.message);
            stream.end();
            throw new Error("Camera image error");
        }
    }
    
    // Settings ================================================================================================
    async onSettings(settings){
        // try {
        //     this._settings = settings.newSettings;
        //     await this.connectPowerEntity();
        // }
        // catch(error) {
        //     this.error("onSettings error: "+ error.message);
        // }
    }
}

module.exports = CameraDevice;