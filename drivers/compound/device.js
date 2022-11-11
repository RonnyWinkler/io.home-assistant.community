'use strict';

const BaseDevice = require('../basedevice');

const CAPABILITIES_SET_DEBOUNCE = 100;

class CompoundDevice extends BaseDevice {

    async onInit() {
        await super.onInit();

        this.compoundCapabilities = this.getData().capabilities;
        this.compoundCapabilitiesConverters = this.getData().capabilitiesConverters;

        // Capability listener for all existing capabilities
        this.registerMultipleCapabilityListener(this.getCapabilities(), async (value, opts) => {
            await this._onCapabilitiesSet(value, opts)
        }, CAPABILITIES_SET_DEBOUNCE);
    }

    // Redefinitionen ============================================================================================
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

    async onInitDevice(){
        super.onInitDevice();

        let updatedEntities = [];
        Object.keys(this.compoundCapabilities).forEach(key => {
            let entityId = this._getCompoundEntityId(this.compoundCapabilities[key]);
            let entity = this._client.getEntity(entityId);
            if (entity){
                if (updatedEntities.indexOf(entityId) == -1){
                    updatedEntities.push(entityId);
                    this.onEntityUpdate(entity);
                }
            }
        });
    }

    inputConverter(compoundCapability) {
        let capability = compoundCapability;
        if (capability.indexOf(".") > -1){
            capability = capability.split(".")[0];
        }

        let capabilityConverter = this.compoundCapabilitiesConverters[capability];

        if(capabilityConverter != null) {
            if(capabilityConverter.from && typeof capabilityConverter.from === "function") {
                return capabilityConverter.from;
            } else if(capabilityConverter.from && typeof capabilityConverter.from === "string") {
                capabilityConverter.from = eval(capabilityConverter.from);
                return capabilityConverter.from;
            }
        }

        return super.inputConverter(capability);
    }

    outputConverter(compoundCapability) {
        let capability = compoundCapability;
        if (capability.indexOf(".") > -1){
            capability = capability.split(".")[0];
        }

        let capabilityConverter = this.compoundCapabilitiesConverters[capability];
        if(capabilityConverter != null) {
            if(capabilityConverter.to && typeof capabilityConverter.to === "function") {
                return capabilityConverter.to;
            } else if(capabilityConverter.to && typeof capabilityConverter.to === "string") {
                capabilityConverter.to = eval(capabilityConverter.to);
                return capabilityConverter.to;
            }
        }

        return super.outputConverter(capability);
    }

    // Entity update ============================================================================================
    async onEntityUpdate(data){
        try {
            Object.keys(this.compoundCapabilities).forEach(async (key) => {
                // Is the entity_id of the compound entity equal (entity itself or entity_id of attribute) 
                let entityId = this._getCompoundEntityId(this.compoundCapabilities[key]);
                if(data != undefined && entityId == data.entity_id) {
    
                    let convert = this.inputConverter(key);

                    let value = null;
                    let entityValue = null;
                    let attribute = this._getCompoundEntityAttribut(this.compoundCapabilities[key]);
                    if (attribute == undefined){
                        entityValue = data.state;
                        value = convert(data.state);
                    }
                    else{
                        entityValue = data.attributes[attribute];
                        value = convert(data.attributes[attribute]);
                    }
                    if ( (value == null || value == undefined) && (entityValue != value) ){
                        if (attribute == undefined){
                            this.log("Update compound device from entity. Value convert error: "+this.entityId+" key: "+key+" entity: "+entityId+" HA state: "+data.state+" converted:"+value);
                        }
                        else{
                            this.log("Update compound device from attribute. Value convert error: "+this.entityId+" key: "+key+" entity: "+entityId+" HA state: "+data.attributes[attribute]+" converted:"+value);
                        }
                    }
                    try {
                        let oldValue = this.getCapabilityValue(key);
                        await this.setCapabilityValue(key, value);
                        if (oldValue!=value){
                            // trigger flow
                            let state = {
                                capability: {
                                    id: key
                                }
                            };
                            let tokens = {
                                capability: key,
                                value_string: '',
                                value_number: 0,
                                value_boolean: false
                            };
                            switch (this.getCapabilityType(key)){
                                case "string":
                                    tokens.value_string = value;
                                    break;
                                case "number":
                                    tokens.value_number = value;
                                    break;
                                case "boolean":
                                    tokens.value_boolean = value;
                                    break;
                            }
                            if (this.homey.app){
                                await this.homey.app._flowTriggerCapabilityChanged.trigger(this, tokens, state);
                            }
                        }
                    }
                    catch(error) {
                        this.error("Update compound device error: "+this.entityId+" key: "+key+" entity: "+entityId+" value:"+value+" error: "+error.message);
                    }
                 }
            });
                
        }
        catch(error) {
            this.error("CapabilitiesUpdate error: "+ error.message);
        }
    }

    _getCompoundEntityId(compoundEntity){
        return compoundEntity.split(".")[0]+"."+compoundEntity.split(".")[1];
    }
    _getCompoundEntityAttribut(compoundEntity){
        return compoundEntity.split(".")[2];
    }

    // Version without attributes
    // async onEntityUpdate(data){
    //     try {
    //         let entityId = data.entity_id;
            
    //         Object.keys(this.compoundCapabilities).forEach(async (key) => {
    //             if(this.compoundCapabilities[key] == entityId) {
    
    //                 // console.log("---------------------------------------------------------------");
    //                 // console.log("update compound device:", this.entityId);
    //                 // console.log("update compound capability:", key);
    //                 // console.log("update compound by entity:", entityId);
    
    //                 let convert = this.inputConverter(key);
    //                 let value = convert(data.state);
    //                 if (value == null || value == undefined)
    //                     this.log("Update compound device. Value convert error: "+this.entityId+" key: "+key+" entity: "+entityId+" HA state: "+data.state+" converted:"+value);
    
    //                 try {
    //                     let oldValue = this.getCapabilityValue(key);
    //                     await this.setCapabilityValue(key, value);
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
    //         });
                
    //     }
    //     catch(error) {
    //         this.error("CapabilitiesUpdate error: "+ error.message);
    //     }
    // }

    // Capabilities ===========================================================================================
    async _onCapabilitiesSet(valueObj, optsObj) {
        try{
            let keys = Object.keys(valueObj);
            for (let i=0; i<keys.length; i++){
                let key = keys[i];
                if (key == 'button.reconnect'){
                    await this.clientReconnect();          
                }
                if (key.startsWith("onoff")){
                    this._onCapabilityOnoff(key, valueObj[keys[i]]);
                }
                if (key.startsWith("button") && key != "button.reconnect"){
                    this._onCapabilityButton(key);
                }
                if (key.startsWith("locked")){
                    this._onCapabilityLocked(key, valueObj[keys[i]]);
                }
                if (key.startsWith("dim")){
                    this._onCapabilityDim(key, valueObj[keys[i]]);
                }
    
            }
        }
        catch(error) {
            this.error("CapabilitiesUpdate error: "+ error.message);
        }

    }

    async _onCapabilityButton( capability, value, opts ) {
        await this._client.turnOnOff(this.compoundCapabilities[capability], true);
    }


    async _onCapabilityOnoff( capability, value, opts ) {
        await this._client.turnOnOff(this.compoundCapabilities[capability], value);
    }

    async _onCapabilityLocked( capability, value, opts ) {
        this.log("onCapabilityLocked", value);
        await this._client.turnOnOff(this.compoundCapabilities[capability], value);
    }

    async _onCapabilityDim( capability, value, opts ) {
        let entityId = this.compoundCapabilities[capability];
        let outputValue = this.outputConverter("dim")(value);
        await this._client.callService("input_number", "set_value", {
            "entity_id": entityId,
            "value": outputValue
        });
    }

    getAutocompleteCapabilityList(){
        let capabilities = this.getCapabilities();
        let result = [];
        for (let i=0; i<capabilities.length; i++){
            if (capabilities[i] != "button.reconnect"){
                let name = capabilities[i] + " ("+this.compoundCapabilities[capabilities[i]]+")";
                result.push({
                    id: capabilities[i],
                    name: name
                })
            }
        }
        return result;
    }
}

module.exports = CompoundDevice;