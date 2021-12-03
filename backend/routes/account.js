const express = require('express')
const { logout } = require('../middlewares/authentication')
const { createAccountValidator, loginValidator } = require('../validators/account')
const { authenticate, isAuthenticatedMiddleware } = require('../middlewares/authentication')
const { ValidationError, User } = require('../models')
const { validate } = require('express-validation')
const { SignJWT } = require('jose')
const { v4: uuidv4 } = require('uuid');
const settings = require('../settings.json')
const router = express.Router()

router.post('/login', validate(loginValidator), async (req, res, next) => {
  try {
    const { emailAddress, password } = req.body
    const user = await User.findOne({ where: { emailAddress } })
    if (!user) res.status(404).json({ detail: 'Account does not exist' })
    else if (await user.isValidPassword(password)) {
      await authenticate(req, user)
      res.json({ user: user.serialize() })
    } else res.status(403).json({ detail: 'Credentials provided are invalid' })
  } catch (error) {
    next(error)
  }
})

router.get('/logout', isAuthenticatedMiddleware, async (req, res, next) => {
  try {
    await logout(req)
    res.status(200).json({ detail: 'Successfully logged out' })
  } catch (error) {
    next(error)
  }
})

router.post('/', validate(createAccountValidator), async (req, res, next) => {
  try {
    const { emailAddress, password, name } = req.body
    const user = await User.create({ emailAddress, password, name })
    await authenticate(req, user)

    const token = new SignJWT({
      iss: settings.SEALD_JWT_SECRET_ID,
      jti: uuidv4(), // Random string with enough entropy to never repeat.
      iat: Math.floor(Date.now() / 1000), // JWT valid only for 10 minutes. `Date.now()` returns the timestamp in milliseconds, this needs it in seconds.
      scopes: [3], // PERMISSION_JOIN_TEAM
      join_team: true
    })
      .setProtectedHeader({ alg: 'HS256' })

    const signupJWT = await token.sign(Buffer.from(settings.SEALD_JWT_SECRET, 'ascii'))
    res.json({ user: user.serialize(), signupJWT })
  } catch (err) {
    if (err instanceof ValidationError) res.status(400).json({ detail: 'A user with the same email address exists' })
    else next(err)
  }
})

router.get('/', isAuthenticatedMiddleware, async (req, res, next) => {
  try {
    const user = await User.findByPk(req.session.user.id)
    res.json({ user: user.serialize() })
  } catch (err) {
    if (err instanceof ValidationError) res.status(400).json({ detail: 'A user with the same email address exists' })
    else next(err)
  }
})

module.exports = router
