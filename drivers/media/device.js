'use strict';

const Homey = require('homey');

const defaultValueConverter = {
    from: (state) => parseFloat(state),
    to: (value) => value
}

const defaultBooleanConverter = {
    from: (state) => (state == "on"),
    to: (value) => (value ? "on" : "off")
}

class MediaDevice extends Homey.Device {

    async onInit() {
        await this.updateCapabilities();

        this._client = this.homey.app.getClient();

        this.entityId = this.getData().id;
        this.capabilities = this.getCapabilities();

        this.log('Device init. ID: '+this.entityId+" Name: "+this.getName()+" Class: "+this.getClass());

        this._client.registerDevice(this.entityId, this);

        // if(this.hasCapability("button")) {
        //     this.registerCapabilityListener('button', async (value, opts) => {this.onCapabilityButton(value, opts)});
        // }

        if(this.hasCapability("onoff")) {
            this.registerCapabilityListener('onoff', async (value, opts) => {
                await this.onCapabilityOnoff(value, opts)
            });
        }

        if(this.hasCapability("volume_set")) {
            this.registerCapabilityListener('volume_set', async (value, opts) => {
                await this.onCapabilityVolumeSet(value, opts)
            });
        }
        if(this.hasCapability("volume_up")) {
            this.registerCapabilityListener('volume_up', async (value, opts) => {
                await this.onCapabilityVolumeUp(value, opts)
            });
        }
        if(this.hasCapability("volume_down")) {
            this.registerCapabilityListener('volume_down', async (value, opts) => {
                await this.onCapabilityVolumeDown(value, opts)
            });
        }
        if(this.hasCapability("volume_mute")) {
            this.registerCapabilityListener('volume_mute', async (value, opts) => {
                await this.onCapabilityVolumeMute(value, opts)
            });
        }
        if(this.hasCapability("speaker_playing")) {
            this.registerCapabilityListener('speaker_playing', async (value, opts) => {
                await this.onCapabilitySpeakerPlaying(value, opts)
            });
        }
        if(this.hasCapability("speaker_next")) {
            this.registerCapabilityListener('speaker_next', async (value, opts) => {
                await this.onCapabilitySpeakerNext(value, opts)
            });
        }
        if(this.hasCapability("speaker_prev")) {
            this.registerCapabilityListener('speaker_prev', async (value, opts) => {
                await this.onCapabilitySpeakerPrev(value, opts)
            });
        }
        if(this.hasCapability("speaker_shuffle")) {
            this.registerCapabilityListener('speaker_shuffle', async (value, opts) => {
                await this.onCapabilitySpeakerShuffle(value, opts)
            });
        }
        if(this.hasCapability("speaker_repeat")) {
            this.registerCapabilityListener('speaker_repeat', async (value, opts) => {
                await this.onCapabilitySpeakerRepeat(value, opts)
            });
        }

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
            this.error("Error adding capability: "+Error.message);
        }
    }

    inputConverter(capability) {
        // let capabilityConverter = this.compoundCapabilitiesConverters[capability];

        // if(capabilityConverter != null) {
        //     if(capabilityConverter.from && typeof capabilityConverter.from === "function") {
        //         return capabilityConverter.from;
        //     } else if(capabilityConverter.from && typeof capabilityConverter.from === "string") {
        //         capabilityConverter.from = eval(capabilityConverter.from);
        //         return capabilityConverter.from;
        //     }
        // }

        if(capability.startsWith("measure_") ||
            capability == "volume_set" ) {
            return defaultValueConverter.from;
        } else {
            return defaultBooleanConverter.from;
        }
    }

    outputConverter(capability) {
        // let capabilityConverter = this.compoundCapabilitiesConverters[capability];
        // if(capabilityConverter != null) {
        //     if(capabilityConverter.to && typeof capabilityConverter.to === "function") {
        //         return capabilityConverter.to;
        //     } else if(capabilityConverter.to && typeof capabilityConverter.to === "string") {
        //         capabilityConverter.to = eval(capabilityConverter.to);
        //         return capabilityConverter.to;
        //     }
        // }

        if(capability.startsWith("measure_") ||
            capability == "dim" || 
            capability == "volume_set" ) {
            return defaultValueConverter.to;
        } else {
            return defaultBooleanConverter.to;
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
        let entity = this._client.getEntity(this.capability);
        if (entity){
            this.onEntityUpdate(entity);
        }
    }

    async onEntityUpdate(data) {
        if(data == null || data.entity_id == null) {
            return;
        }

        try{
            let convert = null;

            if (this.hasCapability("volume_set") && data.attributes.volume_level != null){
                convert = this.inputConverter("volume_set");
                await this.setCapabilityValue("volume_set", Math.round(convert(data.attributes.volume_level)*100)/100);
            }
            if (this.hasCapability("volume_mute") && data.attributes.is_volume_muted != null){
                    this.setCapabilityValue("volume_mute", data.attributes.is_volume_muted);
            }
            if (this.hasCapability("speaker_playing") && data.state != null){
                switch (data.state){
                    case "playing":
                        await this.setCapabilityValue("speaker_playing", true);
                        break;
                    default:
                        await this.setCapabilityValue("speaker_playing", false);
                }
            }
            if (this.hasCapability("speaker_shuffle")){
                if (data.attributes.shuffle != null){
                    await this.setCapabilityValue("speaker_shuffle", data.attributes.shuffle );
                }
                else{
                    await this.setCapabilityValue("speaker_shuffle", false );
                }
            }
            if (this.hasCapability("speaker_repeat")){
                if (data.attributes.repeat != null){
                    switch (data.attributes.repeat){
                        case "off":
                            await this.setCapabilityValue("speaker_repeat", "none");
                            break;
                        case "one":
                            await this.setCapabilityValue("speaker_repeat", "track");
                            break;
                        case "all":
                            await this.setCapabilityValue("speaker_repeat", "playlist");
                            break;
                        default:
                            await this.setCapabilityValue("speaker_repeat", "none");
                    }
                }
                else{
                    await this.setCapabilityValue("speaker_repeat", "none");
                }
            }
            if (this.hasCapability("speaker_artist") && data.attributes.media_artist != null){
                this.setCapabilityValue("speaker_artist", data.attributes.media_artist);
            }
            if (this.hasCapability("speaker_album")){
                if (data.attributes.media_album_name != null){
                    await this.setCapabilityValue("speaker_album", data.attributes.media_album_name);
                }
                else if (data.attributes.app_name != null){
                    await this.setCapabilityValue("speaker_album", data.attributes.app_name);
                }
            }
            if (this.hasCapability("speaker_track") && data.attributes.media_title != null){
                await this.setCapabilityValue("speaker_track", data.attributes.media_title);
            }
            if (this.hasCapability("speaker_duration") && data.attributes.media_duration != null){
                await this.setCapabilityValue("speaker_duration", data.attributes.media_duration);
            }
            if (this.hasCapability("speaker_position") && data.attributes.media_position != null){
                await this.setCapabilityValue("speaker_position", data.attributes.media_position);
            }

            if (this.hasCapability("onoff") && data.state != null){
                switch (data.state){
                    case "on":
                    case "idle":
                    case "playing":
                    case "paused":
                    case "buffering":
                        await this.setCapabilityValue("onoff", true);
                        break;
                    case "off":
                    case "standby":
                        await this.setCapabilityValue("onoff", false);
                        break;
                    default:
                        await  this.setCapabilityValue("onoff", false);
                }
            }
            if (data.attributes.source_list == null){
                await this.setStoreValue("sourceList", '');
                await this.setStoreValue("canSelectSource", false);
            }
            else{
                await this.setStoreValue("sourceList", JSON.stringify(data.attributes.source_list));
                await this.setStoreValue("canSelectSource", true);
            }
            if (data.attributes.sound_mode_list == null){
                await this.setStoreValue("soundModeList", '');
                await this.setStoreValue("canSelectSoundMode", false);
            }
            else{
                await this.setStoreValue("soundModeList", JSON.stringify(data.attributes.sound_mode_list));
                await this.setStoreValue("canSelectSoundMode", true);
            }
        }
        catch(error){
            throw new Error("Device update error: "+error.message);
        }
    }
    // onCapabilityButton( value, opts ) {
    //     this._client.turnOnOff(this.compoundCapabilities["button"], true);
    // }


    async onCapabilityOnoff( value, opts ) {
        // this._client.turnOnOff(this.entityId, value);
        let entityId = this.entityId;
        if (value == true){
            await this._client.callService("media_player", "turn_on", {
                "entity_id": entityId
            });
        }
        else{
            await this._client.callService("media_player", "turn_off", {
                "entity_id": entityId
            });
        }
    }

    async onCapabilityVolumeSet( value, opts ) {
        let entityId = this.entityId;
        let outputValue = this.outputConverter("volume_set")(value);
        outputValue = Math.round(outputValue*100)/100;
        await this._client.callService("media_player", "volume_set", {
            "entity_id": entityId,
            "volume_level": outputValue
        });
    }

    async onCapabilityVolumeUp( value, opts ) {
        let volume = this.getCapabilityValue("volume_set");
        volume = volume + 0.05;
        if (volume > 1){
            volume = 1;
        }
        await this.onCapabilityVolumeSet( volume , opts);
    }

    async onCapabilityVolumeDown( value, opts ) {
        let volume = this.getCapabilityValue("volume_set");
        volume = volume - 0.05;
        if (volume < 0){
            volume = 0;
        }
        await this.onCapabilityVolumeSet( volume , opts);
    }

    async onCapabilityVolumeMute( value, opts ) {
        let entityId = this.entityId;
        let outputValue = value;
        await this._client.callService("media_player", "volume_mute", {
            "entity_id": entityId,
            "is_volume_muted": outputValue
        });
    }

    async onCapabilitySpeakerPlaying( value, opts ) {
        let entityId = this.entityId;
        let outputValue = value;
        if (outputValue){
            await this._client.callService("media_player", "media_play", {
                "entity_id": entityId
            });
        }
        else{
            await this._client.callService("media_player", "media_pause", {
                "entity_id": entityId
            });
        }
    }

    async onCapabilitySpeakerNext( value, opts ) {
        let entityId = this.entityId;
        await this._client.callService("media_player", "media_next_track", {
            "entity_id": entityId
        });
    }

    async onCapabilitySpeakerPrev( value, opts ) {
        let entityId = this.entityId;
        await this._client.callService("media_player", "media_previous_track", {
            "entity_id": entityId
        });
    }

    async onCapabilitySpeakerShuffle( value, opts ) {
        let entityId = this.entityId;
        let outputValue = value;
        await this._client.callService("media_player", "shuffle_set", {
            "entity_id": entityId,
            "shuffle": outputValue
        });
    }

    async onCapabilitySpeakerRepeat( value, opts ) {
        let entityId = this.entityId;
        let outputValue = "off";
        switch (value){
            case "none":
                outputValue = "off";
                break;
            case "track":
                outputValue = "one";
                break;
            case "playlist":
                outputValue = "all";
                break;
        }
        
        await this._client.callService("media_player", "repeat_set", {
            "entity_id": entityId,
            "is_volume_muted": outputValue
        });
    }

    getSourceList(){
        if (this.getStoreValue("canSelectSource") == true){
            let string = this.getStoreValue("sourceList");
            if (string == null){
                return [];
            }
            let list = [];
            try{
                list = JSON.parse(string);
            }
            catch{
                try{
                    list = string.split(',');
                }
                catch{

                }
            }
            let result = [];
            for (let i=0; i<list.length; i++){
                result.push({
                    id: list[i],
                    name: list[i]
                })
            }
            return result;
        }
        else{
            return [];
        }
    }

    async setSource(source){
        let entityId = this.entityId;
        try{
            await this._client.callService("media_player", "select_source", {
            "entity_id": entityId,
            "source": source
            });
        }
        catch(error){
            throw error;
        }
    }

    getSoundModeList(){
        if (this.getStoreValue("canSelectSoundMode") == true){
            let string = this.getStoreValue("soundModeList");
            if (string == null){
                return [];
            }
            let list = [];
            try{
                list = JSON.parse(string);
            }
            catch{
                try{
                    list = string.split(',');
                }
                catch{

                }
            }
            let result = [];
            for (let i=0; i<list.length; i++){
                result.push({
                    id: list[i],
                    name: list[i]
                })
            }
            return result;
        }
        else{
            return [];
        }
    }

    async setSoundMode(mode){
        let entityId = this.entityId;
        try{
            await this._client.callService("media_player", "select_sound_mode", {
                "entity_id": entityId,
                "sound_mode": mode
            });
        }
        catch(error){
            throw error;
        }
    }

    async clientReconnect(){
        await this.homey.app.clientReconnect();
    }
}

module.exports = MediaDevice;