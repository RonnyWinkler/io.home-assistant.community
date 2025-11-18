'use strict';

const BaseDevice = require('../basedevice');

class CameraDevice extends BaseDevice {

    async onInit() {
        await super.onInit();

        // Capability listener for device capabilities
        this.registerCapabilityListener('onoff', async (value, opts) => {
            await this._onCapabilityOnoff(value, opts);
        });
        
        // maintenance actions
        this.registerCapabilityListener('button.reconnect', async () => {
            await this.clientReconnect()
        });

        // Add image 
        this.mediaCover = null;
        this.mediaImage = await this.homey.images.createImage();
        await this.setCameraImage('entity_picture', '',  this.mediaImage);

        try{
            this.mediaVideo = await this.homey.videos.createVideoHLS();
            this.mediaVideo.registerVideoUrlListener( async () => {         
                    return await this._getVideoUrl();
            });
            await this.setCameraVideo('entity_video', 'Video', this.mediaVideo);
        }
        catch(error){
            this.error("Error creating camera video: "+error.message);
        }

        // Get camera URLs
        // try{
        //     this._streamUrl = await this._getStreamUrl();
        //     this._snapshotUrl = await this._getSnapshotUrl();
        // }
        // catch(error){
        //     this.error("Error getting camera urls: "+error.message);
        // }
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

        if(data && data.entity_id && data.entity_id == this.entityId && this.mediaImage) {
            switch (data.state){
                case "on":
                    if (this.hasCapability("onoff")){
                        await this.setCapabilityValue("onoff", true);
                    }
                    if (this.hasCapability("onoff_state")){
                        await this.setCapabilityValue("onoff_state", true);
                    }
                    break;
                case "off":
                    if (this.hasCapability("onoff")){
                        await this.setCapabilityValue("onoff", false);
                    }
                    if (this.hasCapability("onoff_state")){
                        await this.setCapabilityValue("onoff_state", false);
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
                    if (this.mediaImage){
                        await this.mediaImage.update();
                    }
                }
            }
            else{
                if (this.mediaCover != null){
                    if (this.mediaImage){
                        this.mediaImage.setUrl(null);
                        await this.mediaImage.update();
                    }
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

    stream2buffer(stream) {
        return new Promise((resolve, reject) => {
            const _buf = [];
            stream.on("data", (chunk) => _buf.push(chunk));
            stream.on("end", () => resolve(Buffer.concat(_buf)));
            stream.on("error", (err) => reject(err));
        });
    } 

    buffer2stream(buffer) {  
        let stream = new (require('stream').Duplex)();
        stream.push(buffer);
        stream.push(null);
        return stream;
    }

    async _getVideoUrl(){
        let url = await this._getStreamUrl();
        url = url.url;
        if ( ! (url.startsWith("http")) ){
            url =  this.homey.settings.get("address") + url;
        }

        return {
            url: url
        }    
    }

    async _getStreamUrl(){
        if (!this._client){
            throw new Error("HA not connected");
        }
        return await this._client.sendMessage(
            {
                "id": 19,
                "type": "camera/stream",
                "entity_id": this.entityId
            }
        )
    }

    async _getSnapshotUrl(){
        if (!this._client){
            throw new Error("HA not connected");
        }
        return await this._client.sendMessage(
            {
                "id": 19,
                "type": "camera_thumbnail",
                "entity_id": this.entityId
            }
        )
    }

    // Settings ================================================================================================
    async onSettings(settings){
        try {
            if (settings.changedKeys.find((e) => {return e == 'camera_quickaction_disabled'})){
                if (settings.newSettings.camera_quickaction_disabled){
                    // exchange onoff => onoff_state
                    if (this.hasCapability('onoff')){
                        await this.removeCapability('onoff');
                        await this.addCapability('onoff_state');
                    }
                }
                else{
                    // exchange onoff_state => onoff
                    if (this.hasCapability('onoff_state')){
                        await this.removeCapability('onoff_state');
                        await this.addCapability('onoff');
                    }
                }
            }
        }
        catch(error) {
            this.error("onSettings error: "+ error.message);
        }
    }
}

module.exports = CameraDevice;