import SealdSDK from '@seald-io/sdk'
import SealdSDKPluginSSKSPassword from '@seald-io/sdk-plugin-ssks-password'
import settings from '../settings.json'

let sealdSDKInstance = null

const instantiateSealdSDK = async () => {
  sealdSDKInstance = SealdSDK({
    appId: settings.SEALD_APP_ID,
    apiURL: settings.SEALD_API_URL, // Optional. If not set, defaults to public apiURL https://api.seald.io
    plugins: [SealdSDKPluginSSKSPassword(settings.SEALD_KEYSTORAGE_URL)] // Optional. If not set, defaults to public keyStorageURL https://ssks.seald.io
  })
}

export const getSealdSDKInstance = () => sealdSDKInstance

export const createIdentity = async ({ userId, password, signupJWT }) => {
  await instantiateSealdSDK()
  await sealdSDKInstance.initiateIdentity({ signupJWT })
  await sealdSDKInstance.ssksPassword.saveIdentity({ userId, password })
}

export const retrieveIdentity = async ({ userId, password }) => {
  await instantiateSealdSDK()
  await sealdSDKInstance.ssksPassword.retrieveIdentity({ userId, password })
}
