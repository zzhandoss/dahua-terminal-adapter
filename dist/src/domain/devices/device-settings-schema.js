import { DAHUA_EVENT_CODES, DAHUA_FIND_PERSON_TEMPLATE_KEYS } from "./device-settings.js";
const protocolEnum = ["http", "https"];
export const DEVICE_SETTINGS_SCHEMA_VERSION = "2.1.0";
export const deviceSettingsSchema = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "dahua-adapter/device-settings.schema.json",
    title: "Dahua Device Settings",
    description: "Vendor-specific settingsJson for a Dahua device assignment in Device Service.",
    type: "object",
    additionalProperties: false,
    required: [
        "host",
        "username",
        "password",
        "pushAuth",
        "channel",
        "eventCodes",
        "recordBackfillEnabled",
        "backfillLookbackHours",
        "backfillQueryLimit",
        "identityQueryMappings",
        "timePolicy"
    ],
    properties: {
        protocol: {
            type: "string",
            enum: protocolEnum,
            default: "http",
            title: "Protocol",
            description: "Network protocol used to connect to the Dahua device."
        },
        host: {
            type: "string",
            minLength: 1,
            title: "Host",
            description: "Device hostname or IP address."
        },
        port: {
            type: "integer",
            minimum: 1,
            title: "Port",
            description: "Optional TCP port. If omitted, defaults by protocol (80/443)."
        },
        username: {
            type: "string",
            minLength: 1,
            title: "Username",
            description: "Device login username."
        },
        password: {
            type: "string",
            minLength: 1,
            title: "Password",
            description: "Device login password."
        },
        channel: {
            type: "integer",
            minimum: 0,
            default: 0,
            title: "Channel",
            description: "Dahua channel index used for event subscriptions."
        },
        eventCodes: {
            type: "array",
            minItems: 1,
            default: ["AccessControl"],
            title: "Event Codes",
            description: "Allowed event codes expected from Dahua EventHttpUpload/PictureHttpUpload.",
            items: {
                type: "string",
                enum: [...DAHUA_EVENT_CODES],
                description: "Allowed event code values supported by this adapter."
            }
        },
        pushAuth: {
            type: "object",
            additionalProperties: false,
            required: ["username", "password"],
            title: "Push Auth",
            description: "Credentials used by device EventHttpUpload/PictureHttpUpload when calling adapter ingest routes.",
            properties: {
                username: {
                    type: "string",
                    minLength: 1,
                    title: "Push Username",
                    description: "HTTP Digest username configured on terminal for push callbacks."
                },
                password: {
                    type: "string",
                    minLength: 1,
                    title: "Push Password",
                    description: "HTTP Digest password configured on terminal for push callbacks."
                },
                token: {
                    type: "string",
                    minLength: 1,
                    title: "Push Token",
                    description: "Optional legacy shared token. Ingest auth now relies on Digest only."
                }
            }
        },
        requestTimeoutMs: {
            type: "integer",
            minimum: 1,
            title: "Request Timeout (ms)",
            description: "Optional per-device HTTP timeout override."
        },
        rejectUnauthorized: {
            type: "boolean",
            title: "Reject Unauthorized TLS",
            description: "When true, HTTPS certificates must be valid."
        },
        mockEnabled: {
            type: "boolean",
            title: "Mock Device Enabled",
            description: "Use in-process mock device behavior for this assignment when global mock mode is enabled."
        },
        mockIdentityKey: {
            type: "string",
            enum: [...DAHUA_FIND_PERSON_TEMPLATE_KEYS],
            default: "accessUser.Condition.CitizenIDNo",
            title: "Mock Identity Field",
            description: "Which person field mock identity lookup should match against."
        },
        recordBackfillEnabled: {
            type: "boolean",
            default: true,
            title: "Record Backfill Enabled",
            description: "Allow RecordFinder backfill from AccessControlCardRec."
        },
        backfillLookbackHours: {
            type: "integer",
            minimum: 1,
            default: 24,
            title: "Backfill Lookback (hours)",
            description: "How far back adapter queries RecordFinder when DS requests backfill."
        },
        backfillQueryLimit: {
            type: "integer",
            minimum: 1,
            maximum: 1000,
            default: 300,
            title: "Backfill Query Limit",
            description: "Max number of rows requested from RecordFinder per call."
        },
        identityQueryMappings: {
            type: "object",
            title: "Identity Query Mappings",
            description: "Mapping between identity keys and Dahua AccessUser/AccessCard query templates.",
            propertyNames: { minLength: 1 },
            additionalProperties: {
                type: "object",
                additionalProperties: false,
                required: ["provider", "paramsTemplate"],
                properties: {
                    provider: {
                        type: "string",
                        const: "dahua.accessControlIdentity",
                        title: "Provider",
                        description: "Identity lookup provider implementation."
                    },
                    sources: {
                        type: "array",
                        minItems: 1,
                        default: ["accessUser", "accessCard"],
                        title: "Identity Sources",
                        description: "Ordered lookup pipeline for identity matching.",
                        items: {
                            type: "string",
                            enum: ["accessUser", "accessCard"]
                        }
                    },
                    paramsTemplate: {
                        type: "object",
                        title: "Params Template",
                        description: "Template for Dahua access identity params; supports {{identityValue}} placeholder.",
                        propertyNames: {
                            enum: [...DAHUA_FIND_PERSON_TEMPLATE_KEYS],
                            description: "Allowed Dahua AccessUser/AccessCard condition keys available for identity mapping."
                        },
                        additionalProperties: { type: "string" }
                    }
                }
            }
        },
        timePolicy: {
            type: "object",
            additionalProperties: false,
            required: ["mode", "maxDriftMs"],
            title: "Time Policy",
            description: "Controls whether event timestamp is taken from device or adapter clock.",
            default: {
                mode: "boundedDevice",
                maxDriftMs: 60000
            },
            properties: {
                mode: {
                    type: "string",
                    enum: ["boundedDevice", "device", "adapter"],
                    default: "boundedDevice",
                    title: "Timestamp Source Mode",
                    description: "boundedDevice: trust device time only within drift bound; device: always trust device; adapter: always use adapter time."
                },
                maxDriftMs: {
                    type: "integer",
                    minimum: 1,
                    default: 60000,
                    title: "Max Allowed Drift (ms)",
                    description: "Maximum accepted absolute drift between device and adapter clocks in boundedDevice mode."
                }
            }
        }
    }
};
