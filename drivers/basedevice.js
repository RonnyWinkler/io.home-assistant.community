'use strict';

const Homey = require('homey');
const https = require('https');
const lodashget = require('lodash.get');

const CAPABILITIES_SET_DEBOUNCE = 100;

// Device init timeout (sec). Reads entity data with a delay to get ready on app start
const DEVICE_INIT_TIMEOUT = 4;
const DEVICE_MAX_DEVICE_ENTITIES = 20;

const defaultValueConverter = {
    from: (state) => parseFloat(state),
    to: (value) => value
}
const defaultStringConverter = {
    from: (state) => {
        if (state != undefined){
            return state.toString();
        }
        else return "";
    },
    to: (value) => value
}
const defaultBooleanConverter = {
    from: (state) => {
        switch (state){
            case "on":
                return true;
            case "off":
                return false;
            default:
                return null;
        }
        // state == "on"
    },
    to: (value) => (value ? "on" : "off")
}

class BaseDevice extends Homey.Device {
    // App Events ===========================================================
    async onInit() {
        await this.updateCapabilities();

        // temporary state buffer
        this._buttonState = {};

        this._client = this.homey.app.getClient();
        
        // Register device EntityID for updates
        this.entityId = this.getData().id;
        this.log('Device init. ID: '+this.entityId+" Name: "+this.getName()+" Class: "+this.getClass());
        this.clientRegisterDevice();
       
        // EntityID of dynamically assigned measure_ power entity
        this.powerEntityId = null;

        // Capability listener for all existing device entity capabilities
        let deviceEntityCapabilities = this.getDeviceEntitiesCapabilities();
        if (deviceEntityCapabilities.length > 0){
            this.registerMultipleCapabilityListener(deviceEntityCapabilities, async (value, opts) => {
                await this.onDeviceEntitiesSet(value, opts)
            }, CAPABILITIES_SET_DEBOUNCE);
        }

        // Init device with a short timeout to wait for initial entities
        this.timeoutInitDevice = this.homey.setTimeout( async () => 
            // this.onInitDevice().catch(e => console.log(e)), 
            this.homey.app.enqueueDeviceInit(this.onInitDevice.bind(this)),
            DEVICE_INIT_TIMEOUT * 1000 );

        // Queue device init in a queue to process sequential
        // this.homey.app.enqueueDeviceInit(this.onInitDevice.bind(this));
    }

    async onAdded() {
        this.log('device added');
    }

    async onDeleted() {
        this.log('device deleted');
        // Unregister device at client to prevent updates on entity change
        this.clientUnregisterDevice();
        // Remove device icon from /userdata/ (if existing)
        this.driver.tryRemoveIcon(this.getData().id);
        this.driver.tryRemoveIcon(this.getData().id+"_temp");
        // Stop Init timeout if still running 
        if (this.timeoutInitDevice){
            this.homey.clearTimeout(this.timeoutInitDevice);
            this.timeoutInitDevice = null;    
        }
    }

    // Central device functions ===========================================================
    getClient(){
        if (this._client == undefined){
            this._client = this.homey.app.getClient();
        }
        return this._client;
    }

    async clientReconnect(){
        await this.homey.app.clientReconnect();
    }

    clientRegisterDevice(){
        // Basic method for register entityId+client for updated
        // Overload if special register is needed 
        this._client.registerDevice(this.entityId, this);

        // Register deviceEntities
        let entityIds = [];
        let capabilities = this.getCapabilities();
        for (let i=0; i<capabilities.length; i++){
            let capabilityOptions = {};
            try{
                capabilityOptions = this.getCapabilityOptions(capabilities[i]);
            }
            catch(error){continue;}
            let entity = this.getEntityId(capabilityOptions.entity_id);
            if (entity != undefined && entityIds.indexOf(entity) == -1){
                entityIds.push(entity);
            }
        }
        if (entityIds.length > 0){
            this._client.registerCompound(this.entityId, this, entityIds);
        }

    }

    clientUnregisterDevice(){
        // Basic method for unregister entityId+client for updated
        // Overload if special unregister is needed 
        this._client.unregisterDevice(this.entityId);
        // Unregister power entity (if used)
        if (this.powerEntityId != null){
            this._client.unregisterPowerEntity(this.powerEntityId);
        }
        // Unregister deviceEntities
        this._client.unregisterCompound(this.entityId);
     }

    getEntityId(entityId){
        if (entityId == undefined){
            return undefined;
        }
        return entityId.split(".")[0]+"."+entityId.split(".")[1];
    }

    getEntityAttribute(entityId){
        if (entityId.split(".")[2] == undefined){
            return undefined;
        }
        else{
            return entityId.replace(/([^\.]*\.){2}/, '');
        }
    }

    async updateCapabilities(){
        // Base method 
        // Update device capabilities, add new capabilities. Implement in device class
        // throw new Error("Abstract method not implemented");

        // check device class
        try{
            let deviceClass = this.getSetting('device_class');
            if (deviceClass != undefined && deviceClass != "" && deviceClass != this.getClass()){
                await this.setClass(deviceClass);
                this.log("updateCapabilities(): Device class changed to: "+deviceClass);
            }
        }
        catch(error){
            this.error("updateCapabilities(): Error checking/changing device class: "+error.message);
        }

    }

    async setCapabilityEnumList(capability, array){
        let values = [];
        array.forEach(element => {
            values.push( {
                id: element,
                title: element
            });
        });
        try{
            if (!this.hasCapability(capability)){
                await this.addCapability(capability);
            }
            await this.setCapabilityOptions(capability, { values :values});
        }catch(error){}
    }

    async onInitDevice(){
        // Init device on satrtup with latest data to have initial values before HA sends updates
        this.homey.clearTimeout(this.timeoutInitDevice);
        this.timeoutInitDevice = null;

        this.log('Device init data. ID: '+this.entityId+" Name: "+this.getName()+" Class: "+this.getClass());
        let entity = this._client.getEntity(this.entityId);
        if (entity){
            // Call 
            this.onEntityUpdate(entity);
        }

        // Init deviceEntities
        let updatedEntities = [];
        let capabilities = this.getCapabilities();
        for (let i=0; i<capabilities.length; i++){
            let capabilitiesOptions = {};
            try{
                capabilitiesOptions = this.getCapabilityOptions(capabilities[i])
            }
            catch(error){continue;}
            if (capabilitiesOptions.entity_id != undefined){
                let entityId = this.getEntityId(capabilitiesOptions.entity_id);
                let entity = this._client.getEntity(entityId);
                if (entity){
                    if (updatedEntities.indexOf(entityId) == -1){
                        updatedEntities.push(entityId);
                        this.onEntityUpdate(entity);
                    }
                }
            }
        }

        await this.checkDeviceAvailability();

        await this.connectPowerEntity();
    }

    async onEntityUpdate(data) {
        // General device update on Entity change 
        // Implement in device class and call super.onEntityUpdate() to process common updates
        try {
            if (data == null || 
                data.state == undefined ){
                return;
            }

            // Extended app log: log all entity updates
            if (this.homey.app.getLogSettings()['entityState']){
                this.log("Entity state changed: Entity: "+data.entity_id+" State: "+data.state+" Attributes:",data.attributes);
            }

            // Availability check for state only for devices based on a entity - and only if this main entity is unavailable
            if (this.entityId == data.entity_id){
                if (data.state == "unavailable"){
                    await this.setUnavailable(this.homey.__("device_unavailable_reason.entity_unavailable"));
                }
                else{
                    await this.setAvailable();
                }
            }
            if (this.hasCapability("measure_power") && 
                this.powerEntityId != null &&
                data.entity_id == this.powerEntityId){
                let convert = this.inputConverter("measure_power");
                let value = convert(data.state);
                await this.setCapabilityValue("measure_power", value)
            }
            // Update dynamically added device entities
            await this.deviceEntitiesUpdate(data);
        }
        catch(error) {
            this.error("CapabilitiesUpdate error: "+ error.message);
        }
    }

    async checkDeviceAvailability(){
        try{
            let client = this.getClient();
            if (client != undefined){
                if (!this._client.isConnected()){
                    await this.setUnavailable(this.homey.__("device_unavailable_reason.not_connected"));
                }
                else{
                    let entity = this._client.getEntity(this.entityId);
                    if (entity == null){
                        await this.setUnavailable(this.homey.__("device_unavailable_reason.entity_not_found"));
                    }
                    else{
                        // this.setAvailable();
                        this.onEntityUpdate(entity);
                    }
                }
            }
        }
        catch(error){
            this.log("Error: checkDeviceAvailability()");
        }
    }

    // Connected power entity functions ===============================================
    getPowerEntityId(){
        // Abstract method. 
        // Redefine in device class and return the connectes power entity
        return null;
    }

    async connectPowerEntity(){
        // unregister if already set
        if (this.powerEntityId != null){
            this._client.unregisterPowerEntity(this.powerEntityId);
        }

        // Get power entity and connect as additional update source
        let entityId = this.getPowerEntityId();
        if (entityId == null){
            // Device does not define a power entityId => no adding needed
            // if (this.hasCapability('measure_power'))
            // {
            //     await this.removeCapability('measure_power');
            // }
            return;
        }
        // check if entity is present
        let entity = this._client.getEntity(entityId);
        if (entity == null || entity == undefined){
            // Device defines a power entityID, but it's not present => remoce capability
            if (this.hasCapability('measure_power'))
            {
                await this.removeCapability('measure_power');
            }
            return;
        }
        // Remember ID for capability updates and unregister on device deletion 
        this.powerEntityId = entityId;
        // Check if capability already exists, add if needed
        if (!this.hasCapability('measure_power'))
        {
            await this.addCapability('measure_power');
        }
        // Register for entity updates and read first state
        this._client.registerPowerEntity(entityId, this);
        this.onEntityUpdate(entity);
    }

    // Device Entities ===========================================================================================
    getDeviceEntitiesCapabilities(){
        let capabilities = [];
        let keys = this.getCapabilities();
        for (let i=0; i<keys.length; i++){
            let capabilitiesOptions = {};
            try{
                capabilitiesOptions = this.getCapabilityOptions(keys[i]);
            }
            catch(error){continue;}
            if (capabilitiesOptions && capabilitiesOptions.entity_id != undefined){
                capabilities.push(keys[i]);
            }
        }
        return capabilities;
    }

    async addDeviceEntities(type=null){
        this.log("addDeviceEntities()");
        let entitiesList = [];
        if ( this.entityId.startsWith("climate_fan") ){ 
            entitiesList.push("fan."+this.entityId.split(".")[1])
            entitiesList.push("climate."+this.entityId.split(".")[1])
        }
        else{
            entitiesList.push(this.entityId);
        }

        for (let j=0; j<entitiesList.length; j++){
            let entityRegistry = await this._client.getEntityRegistry(null, entitiesList[j]);
            if (!entityRegistry[0] || entityRegistry[0].device_id == undefined || entityRegistry[0].device_id == null){
                // No device assigned
                return;
            }
            let entities = await this._client.getEntityRegistry(entityRegistry[0].device_id, null);
            for (let i=0; ( i < entities.length && i < DEVICE_MAX_DEVICE_ENTITIES ); i++){
                if (entities[i].entity_id == entitiesList[j] ||
                    entities[i].disabled_by != null ||
                    entities[i].hidden_by != null ||
                    type != null && type == 'sensor_diagnostic' && entities[i].entity_category != 'diagnostic' ||
                    type != null && type == 'sensor' && entities[i].entity_category == 'diagnostic' ){
                    continue;
                }
                // get device pattern depending on domain
                let capabilityTemplate = this._client.getCapabilityTemplate(entities[i].entity_id, type);
                this.log("Entity found: "+entities[i].entity_id);
                this.log("Capability template:", capabilityTemplate);
                // add capability to device and deviceEntity registry
                if (capabilityTemplate.capability == undefined){ continue; }

                let capability = capabilityTemplate.capability + '.' + entities[i].entity_id;
                if (!this.hasCapability(capability)){
                    this.log("Adding capability: "+capability);
                    try{
                        await this.addCapability(capability);
                        if (capabilityTemplate.capabilitiesOptions != undefined){
                            await this.setCapabilityOptions(capability, capabilityTemplate.capabilitiesOptions);
                        }
                    }
                    catch(error){
                        this.log("Error adding capability "+capability+": "+error.message);
                    }
                    this.log("Capability added.");
                }
            }
        }

        await this.onInit();
    }

    async removeDeviceEntities(type=null){
        this.log("removeDeviceEntities()")
        let keys  = this.getCapabilities();
        for (let i=0; i<keys.length; i++){
            let capabilityOptions = {};
            try{
                capabilityOptions = this.getCapabilityOptions(keys[i]);
            }
            catch(error){continue;}
            try{ 
                if ( capabilityOptions.entity_id != undefined &&
                     ( type== null || capabilityOptions.entity_type == type) ){
                    this.log("Removing capability: "+keys[i]);
                    if (this.hasCapability(keys[i])){
                        // this.setCapabilityOptions(keys[i], null);
                        await this.removeCapability(keys[i]);
                    }
                    this.log("Capability removed.");
                    
                    // unregister entities
                    device.clientUnregisterDevice();
                    // Reload device (register capability listerner ...)
                    this.onInit();
                }
            }
            catch(error){
                this.log("removeDeviceEntities(): Error removing capability: "+keys[i]+": "+error.message);
            }
        }
    }

    async deviceEntitiesUpdate(data){
        if (!data || !data.entity_id){
            return;
        }
        let entityId = data.entity_id;
        let keys = this.getCapabilities();
        for (let i=0; i<keys.length; i++){
            let capabilitiesOptions = {};
            try{
                capabilitiesOptions = this.getCapabilityOptions(keys[i]);
            }
            catch(error){continue;}
            try{
                if (this.getEntityId(capabilitiesOptions.entity_id) == entityId){
                    let oldValue = this.getCapabilityValue(keys[i]);

                    let newValue = null;
                    let tokens = {
                        capability: keys[i],
                        value_string: '',
                        value_number: 0,
                        value_boolean: false,
                        value_string_old: '',
                        value_number_old: 0,
                        value_boolean_old: false
                    };
                    let state = {
                        capability: {
                            id: keys[i]
                        }
                    };
                    // get converter function
                    let converter = this.getDeviceEntitiesInputConverter(keys[i]);
                    // check if it's an entity or an entity attribute
                    let entityValue = undefined;
                    let attribute = this.getEntityAttribute(capabilitiesOptions.entity_id);
                    if (attribute == undefined){
                        entityValue = data.state;
                    }
                    else{
                        entityValue = lodashget(data.attributes, attribute, null);
                    }

                    if (keys[i].startsWith("measure_generic")){
                        // String capabilities
                        if (converter != undefined){
                            newValue = converter(entityValue);
                        }
                        else{
                            newValue = entityValue;
                        }
                        if (newValue == undefined ){
                            newValue = '';
                        }
                        if (oldValue == undefined ){
                            oldValue = '';
                        }
                        tokens.value_string_old = oldValue;
                        tokens.value_string = newValue;
                        await this.setCapabilityValue(keys[i], newValue);
                    }
                    else if (keys[i].startsWith("alarm")){
                        // boolean capability
                        if (converter != undefined){
                            newValue = converter(entityValue);
                        }
                        else{
                            switch (entityValue){
                                case "on":
                                    newValue = true;
                                    break;
                                case "off":
                                    newValue = false;
                                    break;            
                            }
                            // newValue = (entityValue == "on");
                        }
                        tokens.value_boolean_old = oldValue;
                        tokens.value_boolean = newValue;
                        await this.setCapabilityValue(keys[i], newValue );
                    }
                    else if (keys[i].startsWith("measure") || keys[i].startsWith("meter") || keys[i].startsWith("dim")){
                        // numeric capability
                        if (converter != undefined){
                            newValue = converter(entityValue);
                        }
                        else{
                            newValue = parseFloat(entityValue);
                        }
                        // set value to "0" to prevent flow trigger error
                        if (oldValue == null || oldValue == undefined){
                            tokens.value_number_old = 0;
                        }
                        else{
                            tokens.value_number_old = oldValue;
                        }
                        if (newValue == null || newValue == undefined){
                            tokens.value_number = 0;
                        }
                        else{
                            tokens.value_number = newValue;
                        }
                        await this.setCapabilityValue(keys[i], newValue);
                    }
                    else if (keys[i].startsWith("onoff") || keys[i].startsWith("onoff_button") || keys[i].startsWith("onoff_state") ){
                        // boolean capability
                        if (converter != undefined){
                            newValue = converter(entityValue);
                        }
                        else{
                            switch (entityValue){
                                case "on":
                                    newValue = true;
                                    break;
                                case "off":
                                    newValue = false;
                                    break;            
                            }
                            // newValue = (entityValue == "on");
                        }
                        tokens.value_boolean_old = oldValue;
                        tokens.value_boolean = newValue;
                        // ignore initial state change from initial state to first read state in onInit()
                        if (oldValue == null){
                            oldValue = newValue;
                        }
                        await this.setCapabilityValue(keys[i], newValue );
                    }
                    else if (keys[i].startsWith("button") || keys[i].startsWith("input_button")){
                        if (converter != undefined){
                            newValue = converter(entityValue);
                        }
                        else{
                            newValue = entityValue;
                        }
                        oldValue = this._buttonState[keys[i]];
                        this._buttonState[keys[i]] = newValue;
                        if (oldValue == undefined){
                            oldValue = newValue;
                        }
                    }
                    else{continue;}

                    if (oldValue!=newValue){
                        // trigger flow
                        if (this.homey.app){
                            // Standard capaility changed trigger
                            this.homey.app._flowTriggerCapabilityChanged.trigger(this, tokens, state).catch(error => {this.log("Error triggering flow [capability_changed] for capability "+tokens.capability+": "+error.message)});
                            // additional alarm on/off trigger
                            if (keys[i].startsWith("alarm") || keys[i].startsWith("onoff")){
                                if (newValue){
                                    this.homey.app._flowTriggerGenericAlarmTrue.trigger(this, tokens, state).catch(error => {this.log("Error triggering flow [generic_alarm_true] for capability "+tokens.capability+": "+error.message)});
                                }
                                else{
                                    this.homey.app._flowTriggerGenericAlarmFalse.trigger(this, tokens, state).catch(error => {this.log("Error triggering flow [generic_alarm_false] for capability "+tokens.capability+": "+error.message)});
                                }
                            }
                        }
                    }
    
                }
            }
            catch(error){this.log("deviceEntitiesUpdate(): Entity: "+entityId+" Capability: "+keys[i]+" Error "+error.message)}
        }
    }

    async onDeviceEntitiesSet(valueObj, optsObj) {
        try{
            let keys = Object.keys(valueObj);
            for (let i=0; i<keys.length; i++){
                let key = keys[i];
                let capabilitiesOptions = {};
                try{
                    capabilitiesOptions = this.getCapabilityOptions(keys[i]);
                }
                catch(error){continue;}
                let entityId = capabilitiesOptions.entity_id; 
                let oldValue = this.getCapabilityValue(key);
                if (entityId != undefined){
                    if (key.startsWith("onoff")){
                        // trigger flow on capability change, because on entity update the capability is already set and flow doesn't get triggered
                        let tokens = {
                            capability: keys[i],
                            value_string_old: '',
                            value_number_old: 0,
                            value_boolean_old: oldValue,
                            value_string: '',
                            value_number: 0,
                            value_boolean: valueObj[keys[i]]
                        };
                        let state = {
                            capability: {
                                id: keys[i]
                            }
                        };
                        this.homey.app._flowTriggerCapabilityChanged.trigger(this, tokens, state).catch(error => {this.log("Error triggering flow [capability_changed]: "+error.message)});
                        // additional alarm on/off trigger
                        if (valueObj[keys[i]]){
                            this.homey.app._flowTriggerGenericAlarmTrue.trigger(this, tokens, state).catch(error => {this.log("Error triggering flow [generic_alarm_true]: "+error.message)});
                        }
                        else{
                            this.homey.app._flowTriggerGenericAlarmFalse.trigger(this, tokens, state).catch(error => {this.log("Error triggering flow [generic_alarm_false]: "+error.message)});
                        }
                        
                        // Send state change to HA
                        await this._client.turnOnOff(entityId, valueObj[keys[i]]);
                    }
                    if (key.startsWith("dim")){
                        // Send state change to HA
                        await this._client.callService(entityId.split(".")[0], "set_value", {"entity_id": entityId, value: valueObj[keys[i]]});
                    }
                    if (key.startsWith("button") && key != "button.reconnect"){
                        if (entityId.startsWith("scene") || entityId.startsWith("script")){
                            // Send state change to HA
                            await this._client.turnOnOff(entityId, valueObj[keys[i]]);
                        }
                        else{
                            // Send state change to HA
                            await this._client.callService(entityId.split(".")[0], "press", {"entity_id": entityId});
                        }
                    }
                }
            }
        }
        catch(error) {
            this.error("onDeviceEntitiesSet() error: "+ error.message);
        }

    }

    // Energy settings ================================================================================================
    async setEnergyCumulative(value = false){
        await this.setEnergy(
            { "cumulative": value }
        );
    }

    // Settings ================================================================================================
    async onSettings(settings){
        try {
            if (settings.changedKeys.indexOf('add_device_sensor') > -1){
                if (settings.newSettings['add_device_sensor']){
                    this.log("onSettings(): Add device sensors SET");
                    await this.addDeviceEntities('sensor');
                }
                else{
                    this.log("onSettings(): Add device sensors UNSET");
                    await this.removeDeviceEntities('sensor');
                } 
            }
            if (settings.changedKeys.indexOf('add_device_sensor_diagnostic') > -1){
                if (settings.newSettings['add_device_sensor_diagnostic']){
                    this.log("onSettings(): Add device diagnostic sensors SET");
                    await this.addDeviceEntities('sensor_diagnostic');
                }
                else{
                    this.log("onSettings(): Add device diagnostic sensors UNSET");
                    await this.removeDeviceEntities('sensor_diagnostic');
                } 
            }
            if (settings.changedKeys.indexOf('add_device_switch') > -1){
                if (settings.newSettings['add_device_switch']){
                    this.log("onSettings(): Add device switches SET");
                    await this.addDeviceEntities('switch');
                }
                else{
                    this.log("onSettings(): Add device switches UNSET");
                    await this.removeDeviceEntities('switch');
                } 
            }
            if (settings.changedKeys.indexOf('add_device_button') > -1){
                if (settings.newSettings['add_device_button']){
                    this.log("onSettings(): Add device buttons SET");
                    await this.addDeviceEntities('button');
                }
                else{
                    this.log("onSettings(): Add device buttons UNSET");
                    await this.removeDeviceEntities('button');
                } 
            }
            if (settings.changedKeys.indexOf('device_class') > -1){
                let deviceClass = settings.newSettings['device_class'];
                if (deviceClass != undefined && deviceClass != "" && deviceClass != this.getClass()){
                    await this.setClass(deviceClass);
                    this.log("onSettings(): Device class changed to: "+deviceClass);
                } 
            }
            if (settings.changedKeys.indexOf('set_energy_cumulative') > -1){
                if (settings.newSettings['set_energy_cumulative']){
                    this.log("onSettings(): set_energy_cumulative SET");
                    await this.setEnergyCumulative(true);
                }
                else{
                    this.log("onSettings(): set_energy_cumulative UNSET");
                    await this.setEnergyCumulative(false);
                } 
            }
        }
        catch(error) {
            this.error("onSettings error: "+ error.message);
            return error.message;
        }
    }

    // Helper functions ===========================================================
    getCapabilityType(capability){
        if (capability.startsWith("button")){
            return "string";
        }
        let type = typeof(this.getCapabilityValue(capability));
        if (type == 'string' || type == 'number' || type == 'boolean'){
            return type;
        }
        else{
            if (capability.startsWith("measure_generic")){
                return "string";
            }
            else if( capability.startsWith("measure_") ||
                capability.startsWith("meter_") ||
                capability == "dim" ||
                capability == "volume_set" ) {
                return "number";
            } 
            else {
                return "boolean";
            }
        }
    }

    inputConverter(capability) {
        // // device entity converter
        // let capabilitiesOptions = {};
        // try{
        //     capabilitiesOptions = this.getCapabilityOptions(capability);
        //     if (    capabilitiesOptions && 
        //             capabilitiesOptions.entity_id != undefined &&
        //             capabilitiesOptions.converter_ha2homey ){
        //         let capabilityConverter = capabilitiesOptions.converter_ha2homey;
        //         try{
        //             if( typeof capabilityConverter === "function") {
        //                 return capabilityConverter;
        //             } else if( typeof capabilityConverter === "string") {
        //                 capabilityConverter = eval(capabilityConverter);
        //                 return capabilityConverter;
        //             }
        //         }
        //         catch(error){
        //             this.error("Read cabapilitiesConverter error: "+error.message);
        //             this.error("Read cabapilitiesConverter: ", capabilityConverter);
        //         }
        //     }
        // }
        // catch(error){}

        // default converter
        switch (this.getCapabilityType(capability)){
            case "string":
                return defaultStringConverter.from;
            case "number":
                return defaultValueConverter.from;
            case "boolean":
                return defaultBooleanConverter.from;
        }
    }

    outputConverter(capability) {
        // let capabilitiesOptions = {};
        // try{
        //     capabilitiesOptions = this.getCapabilityOptions(capability);
        //     if (    capabilitiesOptions && 
        //             capabilitiesOptions.entity_id != undefined &&
        //             capabilitiesOptions.converter_homey2ha ){
        //         let capabilityConverter = capabilitiesOptions.converter_homey2ha;
        //         try{
        //             if( typeof capabilityConverter === "function") {
        //                 return capabilityConverter;
        //             } else if( typeof capabilityConverter === "string") {
        //                 capabilityConverter = eval(capabilityConverter);
        //                 return capabilityConverter;
        //             }
        //         }
        //         catch(error){
        //             this.error("Read cabapilitiesConverter error: "+error.message);
        //             this.error("Read cabapilitiesConverter: ", capabilityConverter);
        //         }
        //     }
        // }
        // catch(error){}

        // default converter
        switch (this.getCapabilityType(capability)){
            case "string":
                return defaultStringConverter.to;
            case "number":
                return defaultValueConverter.to;
            case "boolean":
                return defaultBooleanConverter.to;
        }
    }

    getDeviceEntitiesInputConverter(capability) {
        // device entity converter
        let capabilitiesOptions = {};
        try{
            capabilitiesOptions = this.getCapabilityOptions(capability);
            if (    capabilitiesOptions && 
                    capabilitiesOptions.entity_id != undefined &&
                    capabilitiesOptions.converter_ha2homey ){
                let capabilityConverter = capabilitiesOptions.converter_ha2homey;
                try{
                    if( typeof capabilityConverter === "function") {
                        return capabilityConverter;
                    } else if( typeof capabilityConverter === "string" && capabilityConverter != '') {
                        capabilityConverter = eval(capabilityConverter);
                        return capabilityConverter;
                    }
                }
                catch(error){
                    this.error("Read cabapilitiesConverter error: "+error.message);
                    this.error("Read cabapilitiesConverter: ", capabilityConverter);
                    return undefined;
                }
            }
            return undefined;
        }
        catch(error){return undefined;}
    }

    getDeviceEntitiesOutputConverter(capability) {
        // device entity converter
        let capabilitiesOptions = {};
        try{
            capabilitiesOptions = this.getCapabilityOptions(capability);
            if (    capabilitiesOptions && 
                    capabilitiesOptions.entity_id != undefined &&
                    capabilitiesOptions.converter_homey2ha ){
                let capabilityConverter = capabilitiesOptions.converter_homey2ha;
                try{
                    if( typeof capabilityConverter === "function") {
                        return capabilityConverter;
                    } else if( typeof capabilityConverter === "string" && capabilityConverter != '') {
                        capabilityConverter = eval(capabilityConverter);
                        return capabilityConverter;
                    }
                }
                catch(error){
                    this.error("Read cabapilitiesConverter error: "+error.message);
                    this.error("Read cabapilitiesConverter: ", capabilityConverter);
                    return undefined;
                }
            }
            return undefined;
        }
        catch(error){return undefined;}
    }

    // Generic Flow functions ===========================================================================================
    // Flow Trigger 
    getAutocompleteCapabilityList(addStandardCapabilities=false, domain){
        // get device entities capabilities
        let capabilities = this.getDeviceEntitiesCapabilities();
        let result = [];
        for (let i=0; i<capabilities.length; i++){
            let capabilitiesOptions = {};
            try{
                capabilitiesOptions = this.getCapabilityOptions(capabilities[i]);
            }
            catch(error){continue;}
            try{
                if (domain != undefined && domain != capabilitiesOptions.entity_id.split('.')[0]){
                    continue;
                }
                let name;
                if (capabilitiesOptions.title){
                    name = capabilitiesOptions.title;
                }
                else{
                    name = capabilitiesOptions.entity_id;
                }
                result.push({
                    id: capabilities[i],
                    name: name,
                    entityId: capabilitiesOptions.entity_id
                })
            }
            catch(error){this.log("getAutocompleteCapabilityList(): "+error.message)}
        }

        // include standard capabilities
        if (addStandardCapabilities){
            let stdCapabilitites = this.getCapabilities();
            for (let i=0; i<stdCapabilitites.length; i++){
                if (stdCapabilitites[i] == 'button.reconnect'){
                    continue;
                }
                if (result.filter(e =>{ return e.id == stdCapabilitites[i]}).length == 0){
                    result.push({
                        id: stdCapabilitites[i],
                        name: stdCapabilitites[i]
                    });
                }
            }
        }

        return result;
    }

    // Flow Actions 
    getAutocompleteOnoffList(){
        let capabilities = this.getDeviceEntitiesCapabilities();
        let result = [];
        for (let i=0; i<capabilities.length; i++){
            let capabilitiesOptions = {};
            try{
                capabilitiesOptions = this.getCapabilityOptions(capabilities[i]);
            }
            catch(error){continue;}
            if (capabilities[i].startsWith("onoff")){
                try{
                    let name;
                    if (capabilitiesOptions.title){
                        name = capabilitiesOptions.title;
                    }
                    else{
                        name = capabilitiesOptions.entity_id;
                    }
                    result.push({
                        id: capabilities[i],
                        name: name
                    })
                }
                catch(error){this.log("getAutocompleteCapabilityList(): "+error.message)}
            }
        }
        return result;
    }

    getAutocompleteButtonList(){
        let capabilities = this.getDeviceEntitiesCapabilities();
        let result = [];
        for (let i=0; i<capabilities.length; i++){
            let capabilitiesOptions = {};
            try{
                capabilitiesOptions = this.getCapabilityOptions(capabilities[i]);
            }
            catch(error){continue;}
            if (capabilities[i].startsWith("button")){
                try{
                    let name;
                    if (capabilitiesOptions.title){
                        name = capabilitiesOptions.title;
                    }
                    else{
                        name = capabilitiesOptions.entity_id;
                    }
                    result.push({
                        id: capabilities[i],
                        name: name
                    })
                }
                catch(error){this.log("getAutocompleteCapabilityList(): "+error.message)}
            }
        }
        return result;
    }

    getAutocompleteSelectValueList(entityId){
        try{
            let result = [];
            let entity = this._client.getEntity(entityId);
            if (entity && entity.attributes && entity.attributes.options){
                for (let i=0; i<entity.attributes.options.length; i++){
                    result.push({
                        id: entity.attributes.options[i],
                        name: entity.attributes.options[i]
                    });
                }
            }
            return result;
        }
        catch(error){
            this.error("Error reading fan list: "+error.message);
        }   
    }

    async flowActionSwitchAction(capability, action){
        let valueObj = {};
        switch (action){
            case "on":
                valueObj[ capability ] = true;
                break;
            case "off":
                valueObj[ capability ] = false;
                break;
            case "toggle":
                valueObj[ capability ] = !this.getCapabilityValue(capability);
                break;
        }
        await this.onDeviceEntitiesSet( valueObj, {} );
    }

    async flowActionButtonPress(capability){
        let valueObj = {};
        valueObj[ capability ] = true;
        await this.onDeviceEntitiesSet( valueObj, {} );
    }

    async flowActionNumberSet(capability, value){
        let valueObj = {};
        valueObj[ capability ] = value;
        await this.onDeviceEntitiesSet( valueObj, {} );
    }

    async flowActionDynamicSceneCreate(){
        let entities = [];
        let sceneId = this.getData().id.replace(/-/g, "_").replace(/\./g, "_");
        switch (this.driver.id ){
            case 'custom':
                // Custom device, use all added entities
                let capabilities = this.getDeviceEntitiesCapabilities();
                for (let i=0; i<capabilities.length; i++){
                    let capabilitiesOptions = this.getCapabilityOptions(capabilities[i]);
                    entities.push(capabilitiesOptions.entity_id);
                }
                break;
            case 'compound':
                // Compound device, use all assigned entities
                let compoundCapabilities = this._getCompoundCapabilities();
                let keys = Object.keys(compoundCapabilities);
                for(let i=0; i<keys.length; i++){
                    let entityId = this._getCompoundEntityId(compoundCapabilities[keys[i]]);
                    entities.push(entityId);
                }    
                break;     
            default:
                // Standard device, use main entity only
                entities.push(this.entityId);
        }

        let data = {
            snapshot_entities: [],
            scene_id: sceneId
        }
        for (let i=0; i<entities.length; i++){
            data.snapshot_entities.push(entities[i]);
        }
        await this._client.callService("scene", "create", data);
    }

    async flowActionDynamicSceneApply(){
        let sceneId = "scene." + this.getData().id.replace(/-/g, "_").replace(/\./g, "_");
        let target = {
            entity_id: sceneId
        }
        await this._client.callService("scene", "turn_on", {}, target);
    }

    async flowActionSelect(entityId, value){
        await this._client.callService("select", "select_option", {
            "entity_id": entityId,
            "option": value
        });
        return true;
    }

    async flowActionUpdateDevice(){
        this.onInitDevice();
    }


    // async httpGet(url, options){
    //     return new Promise( ( resolve, reject ) =>
    //         {
    //             try
    //             {
    //               let request = https
    //                 .get(url, options, (response) => { 
    //                   if (response.statusCode !== 200){
    //                     response.resume();

    //                     let message = "";
    //                     if ( response.statusCode === 204 )
    //                     { message = "No Data Found"; }
    //                     else if ( response.statusCode === 400 )
    //                     { message = "Bad request"; }
    //                     else if ( response.statusCode === 401 )
    //                     { message = "Unauthorized"; }
    //                     else if ( response.statusCode === 403 )
    //                     { message = "Forbidden"; }
    //                     else if ( response.statusCode === 404 )
    //                     { message = "Not Found"; }
    //                     reject( new Error( "HTTP Error: " + response.statusCode + " " + message ) );
    //                     return;
    //                   }
    //                   else{
    //                     let rawData = '';
    //                     response.setEncoding('utf8');
    //                     response.on( 'data', (chunk) => { rawData += chunk; })
    //                     response.on( 'end', () => {
    //                       resolve( rawData );
    //                     })
    //                   }
    //                 })
    //                 .on('error', (err) => {
    //                   //console.log(err);
    //                   reject( new Error( "HTTP Error: " + err.message ) );
    //                   return;
    //                 });
    //               request.setTimeout( 5000, function()
    //                 {
    //                   request.destroy();
    //                   reject( new Error( "HTTP Catch: Timeout" ) );
    //                   return;
    //                 });
    //               }
    //             catch ( err )
    //             {
    //                 reject( new Error( "HTTP Catch: " + err.message ) );
    //                 return;
    //             }
    //         });
    //   }
}

module.exports = BaseDevice;