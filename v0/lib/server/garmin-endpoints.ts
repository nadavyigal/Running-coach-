export const GARMIN_WEB_BASE_URL = 'https://connect.garmin.com'
export const GARMIN_CONNECT_API_BASE_URL = 'https://connectapi.garmin.com'
export const GARMIN_HEALTH_API_BASE_URL = 'https://apis.garmin.com'

export const GARMIN_OAUTH_AUTHORIZE_URL = `${GARMIN_WEB_BASE_URL}/oauth2Confirm`
export const GARMIN_OAUTH_TOKEN_URL = `${GARMIN_CONNECT_API_BASE_URL}/di-oauth2-service/oauth/token`
export const GARMIN_OAUTH_REVOKE_URL = `${GARMIN_CONNECT_API_BASE_URL}/di-oauth2-service/oauth/revoke`
export const GARMIN_PROFILE_URL = `${GARMIN_HEALTH_API_BASE_URL}/wellness-api/rest/user/id`
export const GARMIN_PERMISSIONS_URL = `${GARMIN_HEALTH_API_BASE_URL}/wellness-api/rest/user/permissions`
