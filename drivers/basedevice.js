'use strict';

const Homey = require('homey');
const https = require('https');

// Device init timeout (sec). Reads entity data with a delay to get ready on app start
const DEVICE_INIT_TIMEOUT = 3;

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
    from: (state) => (state == "on"),
    to: (value) => (value ? "on" : "off")
}

class BaseDevice extends Homey.Device {
    // App Events ===========================================================
    async onInit() {
        await this.updateCapabilities();

        this._client = this.homey.app.getClient();
        
        // Register device EntityID for updates
        this.entityId = this.getData().id;
        this.log('Device init. ID: '+this.entityId+" Name: "+this.getName()+" Class: "+this.getClass());
        this.clientRegisterDevice();
       
        // EntityID of dynamically assigned measure_ power entity
        this.powerEntityId = null;

        // Init device with a short timeout to wait for initial entities
        this.timeoutInitDevice = this.homey.setTimeout( async () => 
            this.onInitDevice().catch(e => console.log(e)), 
            DEVICE_INIT_TIMEOUT * 1000 );

    }

    async onAdded() {
        this.log('device added');
    }

    async onDeleted() {
        this.log('device deleted');
        // Unregister device at client to prevent updates on entity change
        this.clientUnregisterDevice();
        if (this.powerEntityId != null){
           this._client.unregisterDevice(this.powerEntityId);
        }
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
    async clientReconnect(){
        await this.homey.app.clientReconnect();
    }

    clientRegisterDevice(){
        // Basic method for register entityId+client for updated
        // Overload if special register is needed 
        this._client.registerDevice(this.entityId, this);
    }

    clientUnregisterDevice(){
        // Basic method for unregister entityId+client for updated
        // Overload if special unregister is needed 
        this._client.unregisterDevice(this.entityId);
    }

    async updateCapabilities(){
        // Abstract method: 
        // Update device capabilities, add new capabilities. Implement in device class
        throw new Error("Abstract method not implemented");
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

        await this.connectPowerEntity();
    }

    async onEntityUpdate(data) {
        // Abstract method: 
        // Update device based in entity data. #
        // Implement in device class and call super.onEntityUpdate() to process common updates
        // throw new Error("Abstract method not implemented");
        try {
            if (data == null || 
                data.state == undefined ||
                data.state == "unavailable"){
                return;
            }
            if (this.hasCapability("measure_power") && 
                this.powerEntityId != null &&
                data.entity_id == this.powerEntityId){
                let convert = this.inputConverter("measure_power");
                let value = convert(data.state);
                this.setCapabilityValue("measure_power", value)
            }
        }
        catch(error) {
            this.error("CapabilitiesUpdate error: "+ error.message);
        }
    }

    // Connected entities functions ===============================================
    getPowerEntityId(){
        // Abstract method. 
        // Redefine in device class and return the connectes power entity
        return null;
    }

    async connectPowerEntity(){
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
        this._client.registerDevice(entityId, this);
        this.onEntityUpdate(entity);
    }

    // Helper functions ===========================================================
    getCapabilityType(capability){
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
                capability == "dim" ) {
                return "number";
            } 
            else {
                return "boolean";
            }
        }
    }

    inputConverter(capability) {
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
        switch (this.getCapabilityType(capability)){
            case "string":
                return defaultStringConverter.to;
            case "number":
                return defaultValueConverter.to;
            case "boolean":
                return defaultBooleanConverter.to;
        }
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