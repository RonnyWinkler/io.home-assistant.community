'use strict';

const BaseDevice = require('../basedevice');
const lodashget = require('lodash.get');

const CAPABILITIES_SET_DEBOUNCE = 100;

class CustomDevice extends BaseDevice {

    async onInit() {
        // this.compoundCapabilities = this._getCompoundCapabilities();
        // this.compoundCapabilitiesConverters = this._getCompoundCapabilitiesConverters();

        // temporary state buffer
        // this._buttonState = {};

        await super.onInit();

        // set repair hint for empty device
        if (this.hasCapability('custom_hint')){
            await this.setCapabilityValue('custom_hint', this.homey.__("devices.custom.hint01") );
        }

        // Capability listener for all existing capabilities
        // this.registerMultipleCapabilityListener(this.getCapabilities(), async (value, opts) => {
        //     await this._onCapabilitiesSet(value, opts)
        // }, CAPABILITIES_SET_DEBOUNCE);
    }

    // _getCompoundCapabilities(){
    //     let capabilities = this.getStoreValue('capabilities');
    //     if (!capabilities){
    //         capabilities = this.getData().capabilities;
    //         if (!capabilities){
    //             capabilities = {};
    //         }
    //         this.setStoreValue('capabilities', capabilities);
    //     } 
    //     return capabilities;
    // }

    // _getCompoundCapabilitiesConverters(){
    //     let capabilitiesConverters = this.getStoreValue('capabilitiesConverters');
    //     if (!capabilitiesConverters){
    //         capabilitiesConverters = this.getData().capabilitiesConverters;
    //         if (!capabilitiesConverters){
    //             capabilitiesConverters = {};
    //         }
    //         this.setStoreValue('capabilitiesConverters', capabilitiesConverters);
    //     } 
    //     return capabilitiesConverters;
    // }

    // Redefinitionen ============================================================================================
    async checkDeviceAvailability(){
        // don't check availability on device id.
        // ToDo: check all assigned entities...
    }

    // clientRegisterDevice(){
    //     let entityIds = [];
    //     let capabilities = this._getCompoundCapabilities();
    //     let keys = Object.keys(capabilities);
    //     for (let i=0; i<keys.length; i++){
    //         let compoundEntity = capabilities[keys[i]];
    //         let entity = this._getCompoundEntityId(compoundEntity);
    //         if (entityIds.indexOf(entity) == -1){
    //             entityIds.push(entity);
    //         }
    //     }
    //     if (entityIds.length > 0){
    //         this._client.registerCompound(this.entityId, this, entityIds);
    //     }
    // }

    // clientUnregisterDevice(){
    //     this._client.unregisterCompound(this.entityId);
    // }

    async updateCapabilities(){
        super.updateCapabilities();

        // Add new capabilities (if not already added)
        try{
            if (!this.hasCapability('button.reconnect'))
            {
            await this.addCapability('button.reconnect');
            }
        }
        catch(error){
            this.error("updateCapabilities(): Error adding capability: "+error.message);
        }


    }

    async onInitDevice(){
        super.onInitDevice();

        // let updatedEntities = [];
        // Object.keys(this.compoundCapabilities).forEach(key => {
        //     let entityId = this._getCompoundEntityId(this.compoundCapabilities[key]);
        //     let entity = this._client.getEntity(entityId);
        //     if (entity){
        //         if (updatedEntities.indexOf(entityId) == -1){
        //             updatedEntities.push(entityId);
        //             this.onEntityUpdate(entity);
        //         }
        //     }
        // });
    }

    inputConverter(compoundCapability) {
        let capability = compoundCapability;
        let capabilityConverter = this.compoundCapabilitiesConverters[capability];
        
        if (capabilityConverter == undefined && capability.indexOf(".") > -1){
            capability = capability.split(".")[0];
            capabilityConverter = this.compoundCapabilitiesConverters[capability];
        }

        if(capabilityConverter != null) {
            try{
                if(capabilityConverter.from && typeof capabilityConverter.from === "function") {
                    return capabilityConverter.from;
                } else if(capabilityConverter.from && typeof capabilityConverter.from === "string") {
                    capabilityConverter.from = eval(capabilityConverter.from);
                    return capabilityConverter.from;
                }
            }
            catch(error){
                this.error("Read cabapilitiesConverter error: "+error.message);
                this.error("Read cabapilitiesConverter: ", capabilityConverter.from);
            }
        }

        return super.inputConverter(capability);
    }

    outputConverter(compoundCapability) {
        let capability = compoundCapability;
        let capabilityConverter = this.compoundCapabilitiesConverters[capability];

        if (capabilityConverter == undefined && capability.indexOf(".") > -1){
            capability = capability.split(".")[0];
            capabilityConverter = this.compoundCapabilitiesConverters[capability];
        }

        if(capabilityConverter != null) {
            try{
                if(capabilityConverter.to && typeof c === "function") {
                    return capabilityConverter.to;
                } else if(capabilityConverter.to && typeof capabilityConverter.to === "string") {
                    capabilityConverter.to = eval(capabilityConverter.to);
                    return capabilityConverter.to;
                }
            }
            catch(error){
                this.error("Read cabapilitiesConverter error: capability: "+compoundCapability+" error: "+error.message);
                this.error("Read cabapilitiesConverter: ", capabilityConverter.to);
            }
        }

        return super.outputConverter(capability);
    }

    // Device  functions ============================================================================================

    // Entity update ============================================================================================
    // async onEntityUpdate(data){
    //     await super.onEntityUpdate(data);
    //     Object.keys(this.compoundCapabilities).forEach(async (key) => {
    //         try {
    //                 // Is the entity_id of the compound entity equal (entity itself or entity_id of attribute) 
    //             let entityId = this._getCompoundEntityId(this.compoundCapabilities[key]);
    //             if(data != undefined && entityId == data.entity_id) {
    
    //                 let convert = this.inputConverter(key);

    //                 let value = null;
    //                 let entityValue = null;
    //                 let attribute = this._getCompoundEntityAttribut(this.compoundCapabilities[key]);
    //                 if (attribute == undefined){
    //                     entityValue = data.state;
    //                     value = convert(data.state);
    //                 }
    //                 else{
    //                     // Using Lodash.get method to read JSON path
    //                     entityValue = lodashget(data.attributes, attribute, null);
    //                     value = convert(lodashget(data.attributes, attribute, null));
    //                     // entityValue = data.attributes[attribute];
    //                     // value = convert(data.attributes[attribute]);
    //                 }
    //                 if ( (value == null || value == undefined || value == NaN) && (entityValue != value) ){
    //                     if (attribute == undefined || value == NaN){
    //                         this.log("Update compound device from entity. Value convert error: "+this.entityId+" key: "+key+" entity: "+entityId+" HA state: "+data.state+" converted:"+value);
    //                     }
    //                     else{
    //                         this.log("Update compound device from attribute. Value convert error: "+this.entityId+" key: "+key+" entity: "+entityId+" HA state: "+data.attributes[attribute]+" converted:"+value);
    //                     }
    //                 }
    //                 try {
    //                     let oldValue = this.getCapabilityValue(key);
    //                      if (key.startsWith("button")){
    //                         oldValue = this._buttonState[key];
    //                         this._buttonState[key] = value;
    //                         if (oldValue == undefined){
    //                             oldValue = value;
    //                         }
    //                         await this.setCapabilityValue(key, true);
    //                     }
    //                     else{
    //                         await this.setCapabilityValue(key, value);
    //                     }
    //                     if (oldValue!=value){
    //                         // trigger flow
    //                         let state = {
    //                             capability: {
    //                                 id: key
    //                             }
    //                         };
    //                         let tokens = {
    //                             capability: key,
    //                             value_string: '',
    //                             value_number: 0,
    //                             value_boolean: false
    //                         };
    //                         switch (this.getCapabilityType(key)){
    //                             case "string":
    //                                 tokens.value_string = value;
    //                                 break;
    //                             case "number":
    //                                 tokens.value_number = value;
    //                                 break;
    //                             case "boolean":
    //                                 tokens.value_boolean = value;
    //                                 break;
    //                         }
    //                         if (this.homey.app){
    //                             await this.homey.app._flowTriggerCapabilityChanged.trigger(this, tokens, state);
    //                         }
    //                     }
    //                 }
    //                 catch(error) {
    //                     this.error("Update compound device error: "+this.entityId+" key: "+key+" entity: "+entityId+" value:"+value+" error: "+error.message);
    //                 }
    //              }
    //         }
    //         catch(error) {
    //             this.error("CapabilitiesUpdate: CompoundID: "+this.entityId+" key: "+key+" error: "+ error.message);
    //         }
    //     });
    // }

    // _getCompoundEntityId(compoundEntity){
    //     return compoundEntity.split(".")[0]+"."+compoundEntity.split(".")[1];
    // }
    // _getCompoundEntityAttribut(compoundEntity){
    //     if (compoundEntity.split(".")[2] == undefined){
    //         return undefined;
    //     }
    //     else{
    //         return compoundEntity.replace(/([^\.]*\.){2}/, '');
    //     }
    // }


    // Capabilities ===========================================================================================
    // async _onCapabilitiesSet(valueObj, optsObj) {
    //     try{
    //         let keys = Object.keys(valueObj);
    //         for (let i=0; i<keys.length; i++){
    //             let key = keys[i];
    //             if (key == 'button.reconnect'){
    //                 await this.clientReconnect();          
    //             }
    //             if (key.startsWith("onoff")){
    //                 this._onCapabilityOnoff(key, valueObj[keys[i]]);
    //             }
    //             if (key.startsWith("button") && key != "button.reconnect"){
    //                 this._onCapabilityButton(key);
    //             }
    //             if (key.startsWith("locked")){
    //                 this._onCapabilityLocked(key, valueObj[keys[i]]);
    //             }
    //             if (key.startsWith("dim")){
    //                 this._onCapabilityDim(key, valueObj[keys[i]]);
    //             }
    
    //         }
    //     }
    //     catch(error) {
    //         this.error("CapabilitiesUpdate error: "+ error.message);
    //     }

    // }

    
        // Generic Flow functions ===========================================================================================


}

module.exports = CustomDevice;