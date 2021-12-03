const { Sequelize, DataTypes, Model, ValidationError } = require('sequelize')

const config = require('./config')
const Errors = require('./errors')
const { hashPassword, parseHashedPassword } = require('./utils')

const sequelize = new Sequelize(config.sequelize)

class User extends Model {
  async isValidPassword (password) {
    if (!this.hashedPassword) throw Errors.PASSWORD_UNSET
    const { salt } = parseHashedPassword(this.hashedPassword)
    const hashedPassword = await hashPassword(password, salt)
    return hashedPassword === this.hashedPassword
  }

  async setPassword (password) {
    this.hashedPassword = await hashPassword(password)
  }

  static async create ({ emailAddress, name, password }) {
    return super.create({ emailAddress, name, hashedPassword: await hashPassword(password) })
  }

  serialize () {
    return {
      id: this.id,
      name: this.name,
      emailAddress: this.emailAddress
    }
  }
}

User.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    emailAddress: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
      isEmail: true
    },
    hashedPassword: {
      type: DataTypes.STRING
    }
  },
  { sequelize, modelName: 'User' }
)

sequelize.sync()
  .catch(err => {
    console.error(err)
    process.exit(1)
  })

module.exports = { User, sequelize, ValidationError }
