'use strict';

const Homey = require('homey');

class SwitchDevice extends Homey.Device {

    async onInit() {
        await this.updateCapabilities();

        this._client = this.homey.app.getClient();

        this.entityId = this.getData().id;

        this.log('Device init. ID: '+this.entityId+" Name: "+this.getName()+" Class: "+this.getClass());

        this._client.registerDevice(this.entityId, this);

        this.registerCapabilityListener('onoff', async (value, opts) => {
            await this.onCapabilityOnoff(value, opts);
        });
        
        // maintenance actions
        this.registerCapabilityListener('button.reconnect', async () => {
            await this.clientReconnect()
        });

        // Init device with a short timeout to wait for initial entities
        this.timeoutInitDevice = this.homey.setTimeout(async () => this.onInitDevice().catch(e => console.log(e)), 5 * 1000 );

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

    onAdded() {
        this.log('device added');
    }

    onDeleted() {
        this.log('device deleted');
        this._client.unregisterDevice(this.entityId);
    }

    async onInitDevice(){
        // Init device on satrtup with latest data to have initial values before HA sends updates
        this.homey.clearTimeout(this.timeoutInitDevice);
        this.timeoutInitDevice = null;

        this.log('Device init data. ID: '+this.entityId+" Name: "+this.getName()+" Class: "+this.getClass());
        let entity = this._client.getEntity(this.entityId);
        if (entity){
            this.onEntityUpdate(entity);
        }
    }

    async onCapabilityOnoff( value, opts ) {
        await this._client.turnOnOff(this.entityId, value);
    }

    async onEntityUpdate(data) {
        if(data) {
            await this.setCapabilityValue("onoff", data.state == "on");
        }
    }

    async clientReconnect(){
        await this.homey.app.clientReconnect();
    }
    
    async onDeleted() {
        this.driver.tryRemoveIcon(this.getData().id);
        
        if (this.timeoutInitDevice){
            this.homey.clearTimeout(this.timeoutInitDevice);
            this.timeoutInitDevice = null;    
        }
    }
}

module.exports = SwitchDevice;