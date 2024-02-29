'use strict';

const BaseDevice = require('../basedevice');
const lodashget = require('lodash.get');

const CAPABILITIES_SET_DEBOUNCE = 100;

class CompoundDevice extends BaseDevice {

    async onInit() {
        this.compoundCapabilities = this._getCompoundCapabilities();
        this.compoundCapabilitiesConverters = this._getCompoundCapabilitiesConverters();

        // temporary state buffer
        this._buttonState = {};

        await super.onInit();

        // Capability listener for all existing capabilities
        this.registerMultipleCapabilityListener(this.getCapabilities(), async (value, opts) => {
            await this._onCapabilitiesSet(value, opts)
        }, CAPABILITIES_SET_DEBOUNCE);
    }

    _getCompoundCapabilities(){
        let capabilities = this.getStoreValue('capabilities');
        if (!capabilities){
            capabilities = this.getData().capabilities;
            if (!capabilities){
                capabilities = {};
            }
            this.setStoreValue('capabilities', capabilities);
        } 
        return capabilities;
    }

    _getCompoundCapabilitiesConverters(){
        let capabilitiesConverters = this.getStoreValue('capabilitiesConverters');
        if (!capabilitiesConverters){
            capabilitiesConverters = this.getData().capabilitiesConverters;
            if (!capabilitiesConverters){
                capabilitiesConverters = {};
            }
            this.setStoreValue('capabilitiesConverters', capabilitiesConverters);
        } 
        return capabilitiesConverters;
    }

    // Redefinitionen ============================================================================================
    clientRegisterDevice(){
        let entityIds = [];
        let capabilities = this._getCompoundCapabilities();
        let keys = Object.keys(capabilities);
        for (let i=0; i<keys.length; i++){
            let compoundEntity = capabilities[keys[i]];
            let entity = this._getCompoundEntityId(compoundEntity);
            if (entityIds.indexOf(entity) == -1){
                entityIds.push(entity);
            }
        }
        if (entityIds.length > 0){
            this._client.registerCompound(this.entityId, this, entityIds);
        }
    }

    clientUnregisterDevice(){
        this._client.unregisterCompound(this.entityId);
    }

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

    // Entity update ============================================================================================
    async onEntityUpdate(data){
        await super.onEntityUpdate(data);
        Object.keys(this.compoundCapabilities).forEach(async (key) => {
            try {
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
                        // Using Lodash.get method to read JSON path
                        entityValue = lodashget(data.attributes, attribute, null);
                        value = convert(lodashget(data.attributes, attribute, null));
                        // entityValue = data.attributes[attribute];
                        // value = convert(data.attributes[attribute]);
                    }
                    if ( (value == null || value == undefined || value == NaN) && (entityValue != value) ){
                        if (attribute == undefined || value == NaN){
                            this.log("Update compound device from entity. Value convert error: "+this.entityId+" key: "+key+" entity: "+entityId+" HA state: "+data.state+" converted:"+value);
                        }
                        else{
                            this.log("Update compound device from attribute. Value convert error: "+this.entityId+" key: "+key+" entity: "+entityId+" HA state: "+data.attributes[attribute]+" converted:"+value);
                        }
                    }
                    try {
                        let oldValue = this.getCapabilityValue(key);
                         if (key.startsWith("button")){
                            oldValue = this._buttonState[key];
                            this._buttonState[key] = value;
                            if (oldValue == undefined){
                                oldValue = value;
                            }
                            await this.setCapabilityValue(key, true);
                        }
                        else{
                            await this.setCapabilityValue(key, value);
                        }
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
                                value_boolean: false,
                                value_string_old: '',
                                value_number_old: 0,
                                value_boolean_old: false
                            };
                            switch (this.getCapabilityType(key)){
                                case "string":
                                    tokens.value_string = value;
                                    if (oldValue != undefined && oldValue != null){
                                        tokens.value_string_old = oldValue;
                                    }
                                    break;
                                case "number":
                                    tokens.value_number = value;
                                    if (oldValue != undefined && oldValue != null){
                                        tokens.value_number_old = oldValue;
                                    }
                                    break;
                                case "boolean":
                                    tokens.value_boolean = value;
                                    if (oldValue != undefined && oldValue != null){
                                        tokens.value_boolean_old = oldValue;
                                    }
                                    break;
                            }
                            if (this.homey.app){
                                this.homey.app._flowTriggerCapabilityChanged.trigger(this, tokens, state).catch(error => {this.log("Error triggering flow [capability_changed]: "+error.message)});
                                // additional alarm on/off trigger
                                if (key.startsWith("alarm") || key.startsWith("onoff")){
                                    if (value){
                                        this.homey.app._flowTriggerGenericAlarmTrue.trigger(this, tokens, state).catch(error => {this.log("Error triggering flow [generic_alarm_true]: "+error.message)});
                                    }
                                    else{
                                        this.homey.app._flowTriggerGenericAlarmFalse.trigger(this, tokens, state).catch(error => {this.log("Error triggering flow [generic_alarm_false]: "+error.message)});
                                    }
                                }
                            }
                        }
                    }
                    catch(error) {
                        this.error("Update compound device error: "+this.entityId+" key: "+key+" entity: "+entityId+" value:"+value+" error: "+error.message);
                    }
                 }
            }
            catch(error) {
                this.error("CapabilitiesUpdate: CompoundID: "+this.entityId+" key: "+key+" error: "+ error.message);
            }
        });
    }

    _getCompoundEntityId(compoundEntity){
        return compoundEntity.split(".")[0]+"."+compoundEntity.split(".")[1];
    }
    _getCompoundEntityAttribut(compoundEntity){
        if (compoundEntity.split(".")[2] == undefined){
            return undefined;
        }
        else{
            return compoundEntity.replace(/([^\.]*\.){2}/, '');
        }
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
                    await this._onCapabilityOnoff(key, valueObj[keys[i]]);
                }
                if (key.startsWith("button") && key != "button.reconnect"){
                    await this._onCapabilityButton(key);
                }
                if (key.startsWith("locked")){
                    await this._onCapabilityLocked(key, valueObj[keys[i]]);
                }
                if (key.startsWith("dim")){
                    await this._onCapabilityDim(key, valueObj[keys[i]]);
                }
    
            }
        }
        catch(error) {
            this.error("CapabilitiesUpdate error: "+ error.message);
        }

    }

    async _onCapabilityButton( capability, value, opts ) {
        let entityId = this.compoundCapabilities[capability];
        // Use entity domain as service type to support input_button and button dependent on device entity 
        await this._client.callService(entityId.split(".")[0], "press", {
            "entity_id": entityId
        });
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

    async switchAction(capability, action){
        switch (action){
            case "on":
                await this._onCapabilityOnoff( capability, true, {} );
                break;
            case "off":
                await this._onCapabilityOnoff( capability, false, {} );
                break;
            case "toggle":
                await this._onCapabilityOnoff( capability, !this.getCapabilityValue(capability), {} );
                break;
        }
    }

    async switchOn(capability){
        await this._onCapabilityOnoff( capability, true, {} );
    }

    async switchOff(capability){
        await this._onCapabilityOnoff( capability, false, {} );
    }

    async buttonPress(capability){
        await this._onCapabilityButton( capability, false, {} );
    }

    // Settings ================================================================================================
    // async onSettings(settings){
    //     try {
    //         if (settings.changedKeys.indexOf('device_class') > -1){
    //             let deviceClass = settings.newSettings['device_class'];
    //             if (deviceClass != undefined && deviceClass != "" && deviceClass != this.getClass()){
    //                 await this.setClass(deviceClass);
    //                 this.log("onSettings(): Device class changed to: "+deviceClass);
    //             } 
    //         }
    //     }
    //     catch(error) {
    //         this.error("onSettings error: "+ error.message);
    //         throw new Error("Error setting device class");
    //     }
    // }
    
        // Generic Flow functions ===========================================================================================
    // Flow Trigger 
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
    
    // Flow Actions 
    getAutocompleteOnoffList(){
        let capabilities = this.getCapabilities();
        let result = [];
        for (let i=0; i<capabilities.length; i++){
            if (capabilities[i] != "button.reconnect" && capabilities[i].startsWith("onoff")){
                let name = capabilities[i] + " ("+this.compoundCapabilities[capabilities[i]]+")";
                result.push({
                    id: capabilities[i],
                    name: name
                })
            }
        }
        return result;
    }

    getAutocompleteButtonList(){
        let capabilities = this.getCapabilities();
        let result = [];
        for (let i=0; i<capabilities.length; i++){
            if (capabilities[i] != "button.reconnect" && capabilities[i].startsWith("button")){
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