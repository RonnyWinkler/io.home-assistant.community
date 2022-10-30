'use strict';

const Homey = require('homey');

class BaseDriver extends Homey.Driver {

    onPair(session) {
        this.log("onPair()");

        session.setHandler('showView', async (view) => {
            return await this.onShowView(session, view);
          });
      
        session.setHandler("list_devices", async () => {
            return await this.onPairListDevices(session);
        });

        session.setHandler("login", async (data) => {
            return await this.checkLogin(data); 
        });
    }

    async onRepair(session, device) {
        this.log("onRepair()");

        session.setHandler('showView', async (view) => {
            return await this.onShowViewRepair(session, view, device);
        });

        session.setHandler("login", async (data) => {
            return await this.checkLogin(data); 
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
            devices = await this.getDevices(client);
        }

        return devices;
    }

    async getDevices(client){
        // redefine in sub classes and return the driver dependent devices 
    }

}

module.exports = BaseDriver;