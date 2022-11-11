'use strict';

const Homey = require('homey');

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
        this.entityId = this.getData().id;
        this.log('Device init. ID: '+this.entityId+" Name: "+this.getName()+" Class: "+this.getClass());
        this._client.registerDevice(this.entityId, this);

        // Init device with a short timeout to wait for initial entities
        this.timeoutInitDevice = this.homey.setTimeout( async () => 
            this.onInitDevice().catch(e => console.log(e)), 
            DEVICE_INIT_TIMEOUT * 1000 );

    }

    async onAdded() {
        this.log('device added');
    }

    async onDeleted() {
    }

    // Central device functions ===========================================================
    async clientReconnect(){
        await this.homey.app.clientReconnect();
    }
    
    async onDeleted() {
        this.log('device deleted');
        // Unregister device at client to prevent updates on entity change
        this._client.unregisterDevice(this.entityId);
        // Remove device icon from /userdata/ (if existing)
        this.driver.tryRemoveIcon(this.getData().id);
        this.driver.tryRemoveIcon(this.getData().id+"_temp");
        // Stop Init timeout if still running 
        if (this.timeoutInitDevice){
            this.homey.clearTimeout(this.timeoutInitDevice);
            this.timeoutInitDevice = null;    
        }
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
    }

    async onEntityUpdate(data) {
        // Abstract method: 
        // Update device based in entity data. Implement in device class
        throw new Error("Abstract method not implemented");
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

}

module.exports = BaseDevice;