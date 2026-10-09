// Workspace config: workspace-config.json in OneDrive / SharePoint, opened through its sharing link
// (CONFIG_SHARE_URL in js/data.js). Same keys as the old Google Docs config.
import { DEFAULT_TYPE_FILTER, normalizeType } from './leave.js';

export const DEFAULTS = {
    companyName: 'Company',
    typeFilter: DEFAULT_TYPE_FILTER,
    removeEvents: ['-', 'HBD', 'MTL', 'PTL', 'ML', 'RL', 'LOP'],
    totalEmps: 27,
    eventLimits: { PL: 18, SL: 12 },
    adminNames: {},
    holidayList: {},
    userExtraAllowance: {},
    slackWebhookUrl: '',
    calendarName: 'Shared Vacation (IN)',
    calendarGroupId: '',
    calendarLink: ''
};

export class ConfigError extends Error {}

// Parses the config text, missing keys get their default
export function parseConfig(text) {
    let json;
    try {
        json = JSON.parse(text.replace(/^﻿/, ''));
    } catch (e) {
        throw new ConfigError('Your workspace config is invalid: ' + e.message);
    }
    if (!json || typeof json != 'object' || Array.isArray(json)) {
        throw new ConfigError('Your workspace config is invalid: it must be a JSON object');
    }
    const config = {};
    Object.keys(DEFAULTS).forEach((key) => {
        config[key] = json[key] === undefined || json[key] === null ? DEFAULTS[key] : json[key];
    });
    return normalizeTypes(config);
}

// Leave type names with aliases resolved (an "OH" config works with "OPH" calendar events)
function normalizeTypes(config) {
    const list = (types) => Array.from(new Set((types || []).map((t) => (t == '-' ? t : normalizeType(t)))));
    const keys = (obj) => {
        const out = {};
        Object.keys(obj || {}).forEach((t) => {
            out[normalizeType(t)] = obj[t];
        });
        return out;
    };
    config.typeFilter = list(config.typeFilter);
    config.removeEvents = list(config.removeEvents);
    config.eventLimits = keys(config.eventLimits);
    const extra = {};
    Object.keys(config.userExtraAllowance || {}).forEach((name) => {
        extra[name] = keys(config.userExtraAllowance[name]);
    });
    config.userExtraAllowance = extra;
    return config;
}

export async function loadConfig() {
    let text;
    try {
        const item = await graph_get('/shares/' + graph_share_id(CONFIG_SHARE_URL) + '/driveItem');
        const url = item['@microsoft.graph.downloadUrl'];
        if (!url) {
            throw new Error('No download URL for the config file');
        }
        const resp = await fetch(url);
        if (!resp.ok) {
            throw new Error(resp.status + ' ' + resp.statusText);
        }
        text = await resp.text();
    } catch (e) {
        console.log('Config load failed: ', e);
        throw new ConfigError('Your workspace does not seem to have this app configured, or you can not open its config file. (' + e.message + ')');
    }
    return parseConfig(text);
}

// Admins are listed by first name (upper case keys) in adminNames
export function isAdminName(config, name) {
    return !!name && Object.keys(config.adminNames || {}).some((key) => key.toUpperCase() == name.toUpperCase());
}
