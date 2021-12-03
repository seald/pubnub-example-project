/* eslint-env browser */
import { APIClient } from '../services/api'

let currentUser = null
const apiClient = APIClient()

export class Room {
  constructor ({ id, users, one2one, name, ownerId }) {
    this.id = id
    this.users = users
    this.one2one = one2one
    this.name = name
    this.ownerId = ownerId
  }

  async edit ({ name, users }) {
    this.name = name
    this.users = users
  }
}

export class User {
  constructor ({ id, name, emailAddress }) {
    this.id = id
    this.name = name
    this.emailAddress = emailAddress
  }

  static async createAccount ({ emailAddress, password, name }) {
    const { user: { id }, signupJWT } = await apiClient.rest.account.create({
      emailAddress,
      password,
      name
    })
    currentUser = new this({
      id,
      emailAddress,
      name
    })
    return { currentUser, signupJWT }
  }

  static async login ({ emailAddress, password }) {
    const { user: { id, name } } = await apiClient.rest.account.login({
      emailAddress,
      password
    })
    currentUser = new this({
      id,
      emailAddress,
      name
    })
    return currentUser
  }

  static async updateCurrentUser () {
    const { user: { id, emailAddress, name } } = await apiClient.rest.account.status()
    currentUser = new this({
      id,
      emailAddress,
      name
    })
    return currentUser
  }

  static getCurrentUser () {
    return currentUser
  }

  static async logout () {
    await apiClient.rest.account.logout()
    apiClient.io.setOffline()
    currentUser = null
  }
}
