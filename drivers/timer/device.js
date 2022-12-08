'use strict';

const BaseDevice = require('../basedevice');

class TimerDevice extends BaseDevice {

    async onInit() {
        await super.onInit();
        this.registerCapabilityListener('timer_start', async () => {
            await this._onCapabilityTimerService('start');
        });
        this.registerCapabilityListener('timer_pause', async () => {
            await this._onCapabilityTimerService('pause');
        });
        this.registerCapabilityListener('timer_stop', async () => {
            await this._onCapabilityTimerService('cancel');
        });
        this.registerCapabilityListener('timer_finish', async () => {
            await this._onCapabilityTimerService('finish');
        });

        // maintenance actions
        this.registerCapabilityListener('button.reconnect', async () => {
            await this.clientReconnect()
        });
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

    // Entity update ============================================================================================
    async onEntityUpdate(data) {
        try {
            if (data.state != undefined &&
                data.state != "unavailable"){
                try{
                    await this.setCapabilityValue('timer_state', data.state);
                }
                catch(error){
                    this.log("Unknown state: "+data.state);
                }
            }
            if (data.attributes.duration != undefined ){
                await this.setCapabilityValue('timer_duration', data.attributes.duration);
            }
            if (data.attributes.remaining != undefined ){
                await this.setCapabilityValue('timer_remaining', data.attributes.remaining);
            }
        }
        catch(error) {
            this.error("CapabilitiesUpdate error: "+ error.message);
        }
    }

    // Timer events ============================================================================================
    async onTimerEvent(event){
        this.log("Timer-Event: ", event.event_type);
        switch (event.event_type){
            case 'timer.started':
                this.homey.app._flowTriggerTimerStarted.trigger(this, {}, {});
                break;
            case 'timer.paused':
                this.homey.app._flowTriggerTimerPaused.trigger(this, {}, {});
                break;
            case 'timer.cancelled':
                this.homey.app._flowTriggerTimerCancelled.trigger(this, {}, {});
                break;
            case 'timer.restarted':
                this.homey.app._flowTriggerTimerRestarted.trigger(this, {}, {});
                break;
            case 'timer.finished':
                this.homey.app._flowTriggerTimerFinished.trigger(this, {}, {});
                break;
        }
    }

    // Capabilities ===========================================================================================?
    async _onCapabilityTimerService(service){
        let entityId = this.entityId;

        if (service == 'start'){
            let data = { "entity_id": entityId };
            let durationTime = this.getSetting("duration_time");
            let durationSec = this.getSetting("duration_sec");
            if (durationTime != undefined && durationTime != ""){
                data["duration"] = durationTime;
                this.setSettings({duration_time: ""});
            }
            if (durationSec != undefined && durationSec != 0){
                data["duration"] = durationSec;
                this.setSettings({duration_sec: 0});
            }
            await this._client.callService("timer", "start", data);
            return true;
        }
        else{
            await this._client.callService("timer", service, {
                "entity_id": entityId
            });
        }
        return true;
    }

    // Flow actions ===========================================================================================?
    async timerStartDuration(args){
        let entityId = this.entityId;
        let data = { "entity_id": entityId };
        if (args.time != undefined ){
            data["duration"] = args.time;
        }
        if (args.seconds != undefined ){
            data["duration"] = args.seconds;
        }
        await this._client.callService("timer", "start", data);
        return true;
    }
    async timerStart(){
        await this._onCapabilityTimerService('start');
    }
    async timerStop(){
        await this._onCapabilityTimerService('cancel');
    }
    async timerPause(){
        await this._onCapabilityTimerService('pause');
    }
    async timerFinish(){
        await this._onCapabilityTimerService('finish');
    }
}

module.exports = TimerDevice;