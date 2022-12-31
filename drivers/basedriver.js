'use strict';

const Homey = require('homey');

// files
const http = require('http');
const https = require('https');
const fs = require('fs');

function download(url, path, encoding){
    var file = fs.createWriteStream(path);
    return new Promise((resolve, reject) => {
      var responseSent = false;
      const action = url.startsWith('https') ? https.get : http.get;
      action(url, response => {
        if(encoding) {
            response.setEncoding(encoding);
        }
        response.pipe(file);
        file.on('finish', () =>{
          file.close(() => {
            if(responseSent)  return;
            responseSent = true;
            resolve();
          });
        });
      }).on('error', err => {
          if(responseSent)  return;
          responseSent = true;
          reject(err);
      });
    });
}


class BaseDriver extends Homey.Driver {

    onPair(session) {
        this.log("onPair()");
        this.selectedDevices = [];
        let installed = false;

        session.setHandler('showView', async (view) => {
            return await this.onShowView(session, view);
          });
      
        session.setHandler("list_devices", async () => {
            return await this.onPairListDevices(session);
        });

        session.setHandler("login", async (data) => {
            return await this.checkLogin(data); 
        });

        session.setHandler('list_devices_selection', async (data) => {
            // this.log("handler: list_devices_selection");
            return await this.onListDeviceSelection(session, data);
        });
      

        session.setHandler('setRemoteIcon', async (item) => {
            this.log('setRemoteIcon: ' + item.url);
            // if(DEBUG) listFiles("./userdata");
            const root = "../../";
            let deviceFile = "";
            for(let i=0; i<this.selectedDevices.length; i++){
                deviceFile  = await this.downloadIcon(item.url, this.selectedDevices[i].data.id);
                let path = root + deviceFile;
                if (!this.selectedDevices[i].store){
                    this.selectedDevices[i]["store"]={};
                }
                this.selectedDevices[i].store["icon"] = path;
                this.selectedDevices[i]["icon"] = path;
            }
            const file = deviceFile;
            return file;
        });
    
        session.setHandler('setIcon', async (svg) => {
            this.log('setIcon: ' + svg);
            for(let i=0; i<this.selectedDevices.length; i++){
                this.selectedDevices[i].store.icon = svg;
                this.selectedDevices[i].icon = svg
            }
            return svg;
        });

        session.setHandler('saveIcon', async (data) => {
            try {
                this.log('saveIcon: ' + JSON.stringify(data));
                // if(DEBUG) listFiles("./userdata");
                const root = '../../';
                let deviceIconCurrent = "";
                for(let i=0; i<this.selectedDevices.length; i++){

                    this.uploadIcon(data, this.selectedDevices[i].data.id);
                    deviceIconCurrent = "../userdata/"+ this.selectedDevices[i].data.id +".svg";
            
                    if (!this.selectedDevices[i].store){
                        this.selectedDevices[i]["store"]={};
                    }
                    this.selectedDevices[i].store["icon"] = root + deviceIconCurrent;
                    this.selectedDevices[i]["icon"] = root + deviceIconCurrent;
                }            
                const deviceIcon = deviceIconCurrent;
                return deviceIcon;
        
            } catch (error) {
                this.error('saveIcon ERROR ' + JSON.stringify(error));
            }
        });
    
        session.setHandler('install', async (data) => {
            this.log('install devies');
            this.log(JSON.stringify(this.selectedDevices, null, "  "));
            // dynamic icon defifinition for capabilities is not possible using capabilitiesOptions
            // Only icons defined in capability.json are used :(
            // for(let i=0; i<this.selectedDevices.length; i++){
            //     if (this.selectedDevices[i].data.capabilitiesMdiIcons){
            //         let keys = Object.keys(this.selectedDevices[i].data.capabilitiesMdiIcons);
            //         for(let j=0; j<keys.length; j++){
            //             let id = this.selectedDevices[i].data.id + "." + keys[j];
            //             // Read icon from mdi JSON
            //             let url =   "https://raw.githubusercontent.com/Templarian/MaterialDesign-SVG/master/svg/"+ 
            //                         this.selectedDevices[i].data.capabilitiesMdiIcons[keys[j]] +
            //                         ".svg";
            //             // write icon to /userdata
            //             let path = await this.downloadIcon(url, id);

            //             // update device capability icon
            //             this.selectedDevices[i].capabilitiesOptions[keys[j]]["icon"] = path;
            //         }
            //     }
            // }

            installed = true;
            return this.selectedDevices;
        });

        session.setHandler('disconnect', async () => {
            if(installed) {
                this.log("Pairing is finished");
            } else {
                this.log("User aborted");
                for(let i=0; i<this.selectedDevices.length; i++){
                    this.tryRemoveIcon(this.selectedDevices[i].data.id);
                }
            }
        });

    }

    async onRepair(session, device) {
        this.log("onRepair()");
        let installed = false;

        session.setHandler('showView', async (view) => {
            return await this.onShowViewRepair(session, view, device);
        });

        session.setHandler("login", async (data) => {
            return await this.checkLogin(data); 
        });

        session.setHandler('isIconChangeable', async () => {
            let icon = device.getStoreValue("icon");
            if (icon != undefined && icon.startsWith("../../../userdata/")){
                return true;
            }
            else{
                return false;
            }
        });

        session.setHandler('isCapabilityChangeable', async () => {
            let client = this.homey.app.getClient();
            let deviceDef = await this.getDeviceList(client, device.getData().id);
            if (deviceDef && deviceDef[0] && deviceDef[0].capabilities != undefined){
                return true;
            }
            else{
                return false;
            }
        });

        session.setHandler('setRemoteIcon', async (item) => {
            this.log('setRemoteIcon: ' + item.url);
            // if(DEBUG) listFiles("./userdata");
            const root = "../../";
            let deviceFile = await this.downloadIcon(item.url, device.getData().id+"_temp");
            const file = deviceFile;
            return file;
        });
    
        // session.setHandler('setIcon', async (svg) => {
        //     this.log('setIcon: ' + svg);
        //     this.selectedDevices[i].store.icon = svg;
        //     this.selectedDevices[i].icon = svg
        //     return svg;
        // });

        session.setHandler('saveIcon', async (data) => {
            try {
                this.log('saveIcon: ' + JSON.stringify(data));
                // if(DEBUG) listFiles("./userdata");
                const root = '../../';
                let deviceIconCurrent = "";

                this.uploadIcon(data, device.getData().id+"_temp");
                deviceIconCurrent = "../userdata/"+ device.getData().id+"_temp" +".svg";
        
                const deviceIcon = deviceIconCurrent;
                return deviceIcon;
        
            } catch (error) {
                this.error('saveIcon ERROR ' + JSON.stringify(error));
            }
        });
    
        session.setHandler('changeIcon', async (data) => {
            this.log('Change icon for ID '+device.getData().id);
            this.changeIcon(device.getData().id);
            installed = true;
            return;
        });

        session.setHandler('disconnect', async () => {
            if(installed) {
                this.log("Pairing is finished");
            } else {
                this.log("User aborted");
                this.tryRemoveIcon(device.getData().id+"_temp");
            }
        });

        session.setHandler('getEntity', async () => {
            let id = device.getData().id;
            let data = this.homey.app.getClient().getEntity(id);
            if (id.split(".")[0] == "climate_fan"){
                data = {
                    "climate": this.homey.app.getClient().getEntity("climate." + id.split(".")[1]),
                    "fan": this.homey.app.getClient().getEntity("fan." + id.split(".")[1]),
                }
            }
            if (data == null){
                data = this.homey.__("device_unavailable_reason.entity_not_found");
            }
            return data;
        });

        session.setHandler('getLog', async () => {
            return this.homey.app.getLog();
        });

        session.setHandler('updateCapabilities', async () => {
            this.log("Updating device cabapilities...");
            await this.updateCapabilities(device); 
            this.log("Updating device cabapilities finished.");
            return true;
        });
    }

    async checkLogin(data){
        let address = data.username;
        let token = data.password;

        try{
            await this.homey.app.getClient().connect(address, token, true);
            if (this.homey.app.getClient() && this.homey.app.getClient().isConnected()){
                await this.homey.settings.set("address", address);
                await this.homey.settings.set("token", token);

                await new Promise(r => setTimeout(r, 3000));
                return true;
            }
            else{
                return false;
            }
        }
        catch (error){
            this.error("Connection error in pairing login view: "+error.message);
            return false;
        }
    }

    async onShowView(session, view){
        if (view === 'loading') {
            this.log("onShowView(loading)");

            if (this.homey.app.getClient().isConnected()){
                await session.showView("list_devices");
            }
            else{
                let address = this.homey.settings.get("address");
                let token = this.homey.settings.get("token");
                // let address = "";
                // let token = "";

                if(address && address != "" 
                    && token && token != "") {
                    try{
                        await this.homey.app.getClient().connect(address, token, true);
                        if (this.homey.app.getClient().isConnected()){
                            await session.showView("list_devices")
                        }
                        else{
                            await session.showView("login_credentials");
                        }
                    }
                    catch(error){
                        await session.showView("login_credentials");
                    }
                }
                else{
                    await session.showView("login_credentials");
                }
            }
        }
    }

    
    async onShowViewRepair(session, view, device){
    //     if (view === 'update_device') {
    //         this.log("onShowViewRepair(update_device)");
    //         try{
    //             await this.updateDevice(device);
    //             await session.nextView();
    //         }
    //     }    
    }

    async onPairListDevices(session) {
        this.log("onPairListDevices()" );

        let devices = [];
        let client = this.homey.app.getClient();
        if (client.isConnected() == false){
            await session.showView("login_credentials");
        }
        else{
            devices = await this.getDeviceList(client);
        }

        return devices;
    }

    async onListDeviceSelection(session, data){
        if (data.length > 1){
            this.log("handler: list_devices_selection: " + data.length + " devices selected");
        }
        else if (data.length == 1){
            this.log("handler: list_devices_selection: " + data[0].name);
        }
        else{
            this.log("handler: list_devices_selection: No device selected");
        }
        this.selectedDevices = data;
        return;
    }

    tryRemoveIcon(id) {
        try {
            const path = `../userdata/${id}.svg`;
            fs.unlinkSync(path);
            this.log("Icon removed: "+path);
        } catch(error) {
            this.error("Error removing device icon. Perhaps only driver icon was used. Error: "+error.message);
        }
    }

    renameFile(id_old, id_new) {
        try {
            const path_old = `../userdata/${id_old}.svg`;
            const path_new = `../userdata/${id_new}.svg`;
            fs.renameSync(path_old, path_new);
            this.log("Icon reamed: from "+path_old+" to"+path_new);
        } catch(error) {
            this.error("Error renaming device icon: "+path_old+" to"+path_new);
        }
    }

    async downloadIcon(url, id) {
        const path = `../userdata/${id}.svg`;
        await download(url, path);
        //await download(url, path, 'base64');
        return path;
    }

    uploadIcon(img, id) {
        const path = "../userdata/"+ id +".svg";
        const base64 = img.replace("data:image/svg+xml;base64,", '');
        fs.writeFileSync(path, base64, 'base64');
    }

    changeIcon(id) {
        try {
            // remove original icon
            this.tryRemoveIcon(id);
            // rename temp icon to original name
            this.renameFile( id+"_temp", id);
        } catch(error) {
            this.error("Error changeing device icon filename. Error: "+error.message);
        }

    }

    async updateCapabilities(device){
        let client = this.homey.app.getClient();
        let deviceDef = await this.getDeviceList(client, device.getData().id);
        deviceDef = deviceDef[0];
        if (!deviceDef.capabilities){
            return;
        }
        
        this.log("New device definition: ", deviceDef);

        // Remove old entries
        let capabilities = device.getCapabilities();
        for (let i=0; i<capabilities.length; i++){
            await device.removeCapability(capabilities[i]);
        }
        let store = device.getStore();
        if (store){
            let storeKeys = Object.keys(store);
            for (let i=0; i<storeKeys.length; i++){
                if (storeKeys[i] != 'icon'){
                    await device.unsetStoreValue(storeKeys[i]);
                }
            };
        }
        // Add new entries
        capabilities = deviceDef.capabilities;
        for (let i=0; i<capabilities.length; i++){
            await device.addCapability(capabilities[i]);
        }
        if (deviceDef.capabilitiesOptions){
            let coKeys = Object.keys(deviceDef.capabilitiesOptions);
            for (let i=0; i<coKeys.length; i++){
                await device.setCapabilityOptions(coKeys[i], deviceDef.capabilitiesOptions[coKeys[i]] );
            }
        }
        if (deviceDef.store){
            storeKeys = Object.keys(deviceDef.store);
            for (let i=0; i<storeKeys.length; i++){
                await device.setStoreValue(storeKeys[i], deviceDef.store[storeKeys[i]]);
            };
        }

        await device.onInit();
    }

    async getDeviceList(client, id=null){
        // redefine in sub classes and return the driver dependent devices 
    }

}

module.exports = BaseDriver;