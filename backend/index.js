const app = require('express')()
const bodyParser = require('body-parser')
const server = require('http').createServer(app)
const { ValidationError: JoiValidationError } = require('express-validation')
const account = require('./routes/account')
const users = require('./routes/users')
const { sessionMiddleware } = require('./middlewares/authentication')
const cookieParser = require('cookie-parser')
const { settings } = require('./config.js')

if (settings.HTTPS_ENABLED === true) app.set('trust proxy', true) // reset X-Forwarded-* at first reverse proxy
app.use(cookieParser())
app.use(bodyParser.json({ limit: '50mb' }))
app.use(sessionMiddleware)


app.use('/api/account', account)
app.use('/api/users', users)

app.use((err, req, res, next) => {
  if (err instanceof JoiValidationError) return res.status(err.statusCode).json(err)
  return res.status(500).json({ detail: err.toString() })
})

server.listen(4000)
