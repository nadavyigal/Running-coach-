export const GARMIN_WEB_BASE_URL = 'https://connect.garmin.com'
export const GARMIN_HEALTH_API_BASE_URL = 'https://apis.garmin.com'

export const GARMIN_OAUTH_AUTHORIZE_URL = `${GARMIN_WEB_BASE_URL}/oauth2Confirm`
// diauth.garmin.com is the correct domain for token exchange and revoke (not connectapi.garmin.com)
export const GARMIN_OAUTH_TOKEN_URL = 'https://diauth.garmin.com/di-oauth2-service/oauth/token'
export const GARMIN_OAUTH_REVOKE_URL = 'https://diauth.garmin.com/di-oauth2-service/oauth/revoke'
export const GARMIN_PROFILE_URL = `${GARMIN_HEALTH_API_BASE_URL}/wellness-api/rest/user/id`
export const GARMIN_PERMISSIONS_URL = `${GARMIN_HEALTH_API_BASE_URL}/wellness-api/rest/user/permissions`
