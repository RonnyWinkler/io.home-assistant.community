'use strict';

module.exports = {

    async apiWidgetUpdate({ homey, query }) {
        return await homey.app.apiWidgetUpdate( query.driver_id, query.device_id );
    },
    async apiWidgetPost({ homey, query, body }) {
        return await homey.app.apiWidgetPost( query.driver_id, query.device_id, body );
    },
    async apiWidgetGet({ homey, query }) {
        return await homey.app.apiWidgetGet( query.driver_id, query.device_id, query.command );
    }
};