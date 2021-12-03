/* eslint-env browser */

// APIClient for REST API
export const APIClient = baseURL => {
  const _url = baseURL ? new URL(baseURL) : window.location
  baseURL = _url.origin
  const prefixURL = _url.pathname + 'api'
  const request = async (url, method, body, jsonContentType = true) => {
    const _request = {
      headers: {
        Accept: 'application/json'
      },
      method: method
    }
    if (jsonContentType) {
      _request.headers['Content-type'] = 'application/json'
    }
    if (body) _request.body = jsonContentType ? JSON.stringify(body) : body
    const response = await fetch(url, _request)
    const json = await response.json()
    if (response.status !== 200) throw new Error(JSON.stringify(json))
    return json
  }

  const POST = (url, body) => request(new URL(prefixURL + url, baseURL).toString(), 'POST', body)
  const GET = (url, body) => request(new URL(prefixURL + url, baseURL).toString(), 'GET', body)

  return {
    rest: {
      account: {
        status: () => GET('/account'),
        create: body => POST('/account', body),
        login: body => POST('/account/login', body),
        logout: () => GET('/account/logout')
      }
    }
  }
}

