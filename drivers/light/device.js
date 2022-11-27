'use strict';

const BaseDevice = require('../basedevice');
const colorsys = require('../../lib/colorsys.js');

const CAPABILITIES_SET_DEBOUNCE = 100;

class LightDevice extends BaseDevice {

    async onInit() {
        await super.onInit();

        this._minMireds = 0;
        this._maxMireds = 0;

        this.registerMultipleCapabilityListener(this.getCapabilities(), async (value, opts) => {
            await this._onCapabilitiesSet(value, opts)
        }, CAPABILITIES_SET_DEBOUNCE);
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
            let entityId = "sensor." + this.entityId.split('.')[1] + "_power"; 
            return entityId;
        }
        catch(error){
            this.error("Error getting power entity ID for device "+this.entityId);
            return null;
        }
    }

    // Entity update ============================================================================================
    async onEntityUpdate(data) {
        await super.onEntityUpdate(data);

        if(data==null || data.entity_id != this.entityId){
            return;
        }
        try {

            // this.log("Light update from HA: ");
            // this.log(JSON.stringify(data, null, "  "));

            this._minMireds = data.attributes["min_mireds"] || 0;
            this._maxMireds = data.attributes["max_mireds"] || 0;

            let lightOn = data.state == "on";

            this.setCapabilityValue("onoff", lightOn);

            if(lightOn) {

                if(this.hasCapability("dim")) {
                    let brightness = data.attributes["brightness"]; // 0..255 -> 0..1
                    if(brightness != 0) {
                        await this.setCapabilityValue("dim", 1.0 / 255 * brightness);
                        // .catch(error => {
                        //     this.error("Device "+this.getName()+": Error set dim capability, brightness value: "+brightness+" Error: "+error.message);
                        // });
                    }
                }

                let hasLightMode = this.hasCapability("light_mode");
                let hs = null;
    
                if(this.hasCapability("light_hue")) {
                    hs = data.attributes["hs_color"];
                    if(hs) {
                        let hue = 1.0 / 360.0 * hs[0]; // 0..360 -> 0..1
                        let sat = 1.0 / 100.0 * hs[1]; // 0..100 -> 0..1
    
                        await this.setCapabilityValue("light_hue", hue);
                            // .catch(error => {
                            //     this.error("Device "+this.getName()+": Error set hue capability, value: "+hue+" Error: "+error.message);
                            // });
                        await this.setCapabilityValue("light_saturation", sat)
                            // .catch(error => {
                            //     this.error("Device "+this.getName()+": Error set light_saturation capability, value: "+sat+" Error: "+error.message);
                            // });
                    }
                }
    
                if(this.hasCapability("light_temperature")) {
                    let temperature = data.attributes["color_temp"];
                    if(temperature) {
                        let temp = 1.0 / (this._maxMireds - this._minMireds) * (temperature - this._minMireds);
                        await this.setCapabilityValue("light_temperature", temp);
                            // .catch(error => {
                            //     this.error("Device "+this.getName()+": Error set light_temperature capability, value: "+temp+" Error: "+error.message);
                            // });
                    }
                }
    
                if(hasLightMode) {
                    let light_mode = hs ? "color" : "temperature";
                    
                    await this.setCapabilityValue("light_mode", hs ? "color" : "temperature");
                        // .catch(error => {
                        //     this.error("Device "+this.getName()+": Error set light_mode capability, value: "+hs+" Error: "+error.message);
                        // });
                }
            }
        }
        catch(error) {
            this.error("Device update error: "+ error.message);
        }
    }

    // Capabilities ============================================================================================
    // async _onCapabilityOnoff( value, opts ) {
    //     await this._client.turnOnOff(this.entityId, value);
    // }

    _getCapabilityUpdate(valueObj, capability) {
        let value = valueObj[capability];
        if(typeof value === 'undefined') value = this.getCapabilityValue(capability)
        return value;
    }

    _hasCapabilityUpdate(valueObj, capability) {
        let value = valueObj[capability];
        return(typeof value !== 'undefined');
    }

    async _onCapabilitiesSet(valueObj, optsObj) {
        try{
            // read duration value
            let duration = null;
            if (valueObj.duration){
                duration = valueObj.duration / 1000;
            }
            Object.keys(optsObj).forEach(id => {
                if (optsObj[id] && optsObj[id].duration){
                    duration = optsObj[id].duration;
                }
            });

            if (valueObj["button.reconnect"]){
                await this.clientReconnect();   
                return;       
            }

            // if( typeof valueObj.dim === 'number' ) {
            //     valueObj.onoff = valueObj.dim > 0;	
            // }

            let lightOn = this._getCapabilityUpdate(valueObj, "onoff");

            let data = {
                entity_id: this.entityId
            };

            if(lightOn) {

                if(this.hasCapability("dim")) {
                    let bri = this._getCapabilityUpdate(valueObj, "dim");
                    // if(bri != this.getCapabilityValue("dim")) {
                        data["brightness"] = bri * 255.0;

                        await this.setCapabilityValue("dim", bri);
                    // }
                }

                let lightModeUpdate = null;

                if( this._hasCapabilityUpdate(valueObj, "light_hue") || 
                    this._hasCapabilityUpdate(valueObj, "light_saturation")) {

                    lightModeUpdate = "color";

                    let hue = this._getCapabilityUpdate(valueObj, "light_hue");
                    let sat = this._getCapabilityUpdate(valueObj, "light_saturation");

                    if( hue != this.getCapabilityValue("light_hue") ||
                         sat != this.getCapabilityValue("light_saturation")) {

                        data["hs_color"] = [
                            hue * 360.0,
                            sat * 100.0
                        ]

                        await this.setCapabilityValue("light_hue", hue);
                        await this.setCapabilityValue("light_saturation", sat);
                }
        
                } 
                else if(this._hasCapabilityUpdate(valueObj, "light_temperature")) {
                    lightModeUpdate = "temperature";

                    let tmp = this._getCapabilityUpdate(valueObj, "light_temperature");

                    if(tmp != this.getCapabilityValue("light_temperature")) {
                        data["color_temp"] = ((this._maxMireds - this._minMireds) * tmp) + this._minMireds;

                        await this.setCapabilityValue("light_temperature", tmp);
                    }
                }

                if(lightModeUpdate && this.hasCapability("light_mode")) {
                    await this.setCapabilityValue("light_mode", lightModeUpdate);
                }
            }
            if (duration != null){
                data["transition"] = duration / 1000;
                // If switch off with duration, this will result in a dim to 0. Update device, too
                // if (!lightOn){
                //     await this.setCapabilityValue("dim", 0);
                // }
            }
            await this._client.updateLight(lightOn, data);
        }
        catch(error) {
            let errormsg;
            if (error.message != undefined){
                errormsg = error.message;
            }
            else{
                errormsg = error;
            }
            this.error("CapabilitiesUpdate error: "+ errormsg);
        }
    
    }

    // Flow actions ============================================================================================
    async setHue(args){
        this._onCapabilitiesSet(args, null);
    }

    async setColor(args){
        let hsv = colorsys.hex2Hsv(args.light_color);
        // this.log(hsv);
        let value = {
            "light_hue": hsv.h / 360,
            "light_saturation": hsv.s / 100,
            "dim": hsv.v / 100
        };
        if (args.duration != undefined){
            value["duration"] = args.duration; 
        }
        // this.log(value);
        this._onCapabilitiesSet(value, null);
    }

    async setColorName(args){
        let color = args.light_color_name.color;
        let hsv = colorsys.hex2Hsv(color);
        // this.log(hsv);
        let value = {
            "light_hue": hsv.h / 360,
            "light_saturation": hsv.s / 100,
            "dim": hsv.v / 100 
        };
        if (args.dim != undefined){
            value.dim = args.dim; 
        }
        if (args.duration != undefined){
            value["duration"] = args.duration; 
        }
        // this.log(value);
        this._onCapabilitiesSet(value, null);
    }

    async setTemperature(args){
        this._onCapabilitiesSet(args, null);
    }
}

module.exports = LightDevice;