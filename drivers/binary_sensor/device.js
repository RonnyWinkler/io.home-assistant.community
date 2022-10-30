'use strict';

const Homey = require('homey');

class BinarySensorDevice extends Homey.Device {

    async onInit() {
        await this.updateCapabilities();

        this._client = this.homey.app.getClient();

        this.entityId = this.getData().id;
        this.capabilities = this.getCapabilities();

        this.log('Device init. ID: '+this.entityId+" Name: "+this.getName()+" Class: "+this.getClass());

        this._client.registerDevice(this.entityId, this);

        // maintenance actions
        this.registerCapabilityListener('button.reconnect', async () => {
            await this.clientReconnect()
        });

        // Init device with a short timeout to wait for initial entities
        this.timeoutInitDevice = this.homey.setTimeout(async () => this.onInitDevice().catch(e => console.log(e)), 5 * 1000 );
    }

    async updateCapabilities(){
        // Add new capabilities (if not already added)
        if (!this.hasCapability('button.reconnect'))
        {
          await this.addCapability('button.reconnect');
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
        this.log('Device init data. ID: '+this.entityId+" Name: "+this.getName()+" Class: "+this.getClass());
        let entity = this._client.getEntity(this.entityId);
        if (entity){
            this.onEntityUpdate(entity);
        }
    }

    async onEntityUpdate(data) {
        try {
            this.capabilities.forEach(capability => {
                this.setCapabilityValue(capability, data.state == "on")
                .catch(error => {
                    this.error("Capability update error "+error.message);
                });
            });
        }
        catch(error) {
            this.error("Device update error: "+ error.message);
        }
    }

    // async onCapabilityOnoff( value, opts ) {
    //     let oldValue = this.getCapabilityValue('onoff');
    //     this.setCapabilityValue("onoff", oldValue);
    // }

    async clientReconnect(){
        await this.homey.app.clientReconnect();
    }
}

module.exports = BinarySensorDevice;