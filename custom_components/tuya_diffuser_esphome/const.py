"""Constants for the Tuya Diffuser ESPHome integration."""

DOMAIN = "tuya_diffuser_esphome"
PLATFORMS = ["humidifier", "select", "number", "sensor"]

CARD_RESOURCE_PATH = f"/api/{DOMAIN}/frontend"
CARD_RESOURCE_URL = f"{CARD_RESOURCE_PATH}/tuya-diffuser-esphome-card.js"
CARD_TYPE = "custom:tuya-diffuser-esphome-card"

CONF_DEVICE_ID = "device_id"
CONF_TITLE = "title"
CONF_CANDIDATE = "candidate"
CONF_SOURCE_TYPE = "source_type"
SOURCE_AUTO = "auto"
SOURCE_MANUAL = "manual"

CONF_MIST_MODE_ENTITY = "mist_mode_entity"
CONF_MIST_STRENGTH_ENTITY = "mist_strength_entity"
CONF_COUNTDOWN_MINUTES_ENTITY = "countdown_minutes_entity"
CONF_COUNTDOWN_LEFT_ENTITY = "countdown_left_entity"
CONF_LIGHT_ENTITY = "light_entity"

ATTR_MIST_STRENGTH = "mist_strength"
ATTR_COUNTDOWN_MINUTES = "countdown_minutes"
ATTR_COUNTDOWN_LEFT = "countdown_left"
ATTR_SOURCE_ENTITIES = "source_entities"
ATTR_CARD_RESOURCE_URL = "card_resource_url"
ATTR_CARD_TYPE = "card_type"
ATTR_DEVICE_ID = "device_id"
ATTR_LIGHT_ENTITY = "light_entity"

ATTR_STRENGTH = "strength"
ATTR_MINUTES = "minutes"

SERVICE_SET_MIST_STRENGTH = "set_mist_strength"
SERVICE_SET_COUNTDOWN_MINUTES = "set_countdown_minutes"

DATA_ENTITIES = "entities"
DATA_FRONTEND_REGISTERED = "frontend_registered"
DATA_SERVICES_REGISTERED = "services_registered"

OPTION_OFF = "Off"
OPTION_CONTINUOUS = "Continuous"
OPTION_INTERVAL = "Interval"
OPTION_COUNTDOWN = "Countdown"
OPTION_LOW = "Low"
OPTION_HIGH = "High"

MODE_CONTINUOUS = "continuous"
MODE_INTERVAL = "interval"
MODE_COUNTDOWN = "countdown"

MODE_TO_OPTION = {
    MODE_CONTINUOUS: OPTION_CONTINUOUS,
    MODE_INTERVAL: OPTION_INTERVAL,
    MODE_COUNTDOWN: OPTION_COUNTDOWN,
}

OPTION_TO_MODE = {value: key for key, value in MODE_TO_OPTION.items()}

STRENGTH_LOW = "low"
STRENGTH_HIGH = "high"

STRENGTH_TO_OPTION = {
    STRENGTH_LOW: OPTION_LOW,
    STRENGTH_HIGH: OPTION_HIGH,
}

OPTION_TO_STRENGTH = {value: key for key, value in STRENGTH_TO_OPTION.items()}

REQUIRED_ENTITY_KEYS = (
    CONF_MIST_MODE_ENTITY,
    CONF_MIST_STRENGTH_ENTITY,
    CONF_COUNTDOWN_MINUTES_ENTITY,
    CONF_COUNTDOWN_LEFT_ENTITY,
)
