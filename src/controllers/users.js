const createError = require('http-errors')
const bcrypt = require('bcrypt')
const { v4: uuidv4 } = require('uuid')
const jwt = require('jsonwebtoken')
const crypto = require('crypto-js/md5')

const usersModels = require('../models/users')
const { pagination } = require('../helpers/pagination')
const { response } = require('../helpers/response')
const sendEmail = require('../helpers/sendEmail')
const sendEmailForgotPassword = require('../helpers/sendEmailForgotPassword')

const usersController =  {
  getUsers: async (req, res, next) => {
    const { limit = 4, page = 1, order = "DESC" } = req.query
    const offset = (parseInt(page) - 1) * parseInt(limit)
    const username = req.query.username || null

    const setPagination = await pagination(limit, page, "users", "users")
    usersModels.getUsers(limit, offset, order, username)
      .then(results => {
        const setResults = {
          pagination: setPagination,
          users: results
        }
        response(res, setResults,{ status: 'succeed', statusCode: '200' }, null)
      })
      .catch(() => {
        const error = new createError(500, 'Looks like server having trouble')
        return next(error)
      })
  },
  getUserById: async (req, res, next) => {
    const { idUser } = req.params
    console.log(idUser)
    if(!idUser){
      const error = new createError(400, 'Id user cannot be empty')
      return next(error)
    }
    usersModels.getUserById(idUser)
    .then(results => {
      if(results.length < 1){
        const error = new createError(400, 'Id user cannot be empty')
        return next(error)
      }
      response(res, results[0], { status: 'succeed', statusCode: 200 }, null)
    })
    .catch(() => {
      const error = new createError(500, 'Looks like server having trouble')
      return next(error)
    })
  },
  registerUsers: (req, res, next) => {
    const id = uuidv4()
    const { email, password, phoneNumber } = req.body
    usersModels.checkUsers(email)
    .then((result) => {
        if (result.length > 0) {
            const error = new createError(409, `Forbidden: Email already exists. `)
            return next(error)
        }

        bcrypt.genSalt(10, function (err, salt) {
            bcrypt.hash(password, salt, function (err, hash) {
                const data = {
                    id,
                    email,
                    password: hash,
                    phoneNumber,
                    createdAt: new Date()
                }
                
                usersModels.insertUsers(data)
                .then(() => {
                    return response(res, {message: 'User Has been created'}, {
                        status: 'succeed',
                        statusCode: 200
                      }, null)
                })
            })
        })
    })
  },
  loginUsers: (req, res, next) => {
    const { email, password } = req.body
    usersModels.checkUsers(email)
      .then((result) => {
          const user = result[0]
          if(result.length===0){
            const error = new createError(401, 'Email or Password Wrong')
            return next(error)      
           }
          if(parseInt(user.emailVerification) === 0) {
            const error = new createError(401, 'Email has not been verified')
            return next(error)
          }
          // compare/verify password
          bcrypt.compare(password, user.password, function (err, resCheck) {
              if (!resCheck) {
                  const error = new createError(401, `Password Wrong `)
                  return next(error)
              }
              delete user.password
              delete user.roleID
              delete user.updatedAt
              delete user.createdAt
              console.log(user)
          // jsonwebtoken
          // accessToken 
          jwt.sign({ userId: user.id, email: user.email }, process.env.ACCESS_TOKEN_KEY, { expiresIn: '24h' }, function (err, accessToken) {
            // refreshtoken  
            jwt.sign({ userId: user.id, email: user.email }, process.env.REFRESH_TOKEN_KEY, { expiresIn: '48h' }, function (err, refreshToken) {
                const responseMessage = {
                    accessToken: accessToken,
                    refreshToken: refreshToken
                }
                return response(res, responseMessage, {
                    status: 'succeed',
                    statusCode: 200
                  }, null)
            })
          })
      })
  })
  },
  deleteUser: (req, res, next) => {
  const idUser = req.params.idUser
  usersModels.deleteUser(idUser)
  .then(result => {
    const resultUser = result
    response(res, {message: 'Deleted success'}, {
      status: 'succeed',
      statusCode: 200
    }, null)
  })
  .catch(() => {
    const error = new createError(500, 'Looks like server having trouble')
    return next(error)
  })
  },
    updateUser: (req, res, next) => {
      const id = req.params.id
      console.log(req.body.email)
    
      const { email, phoneNumber, gender, username, firstName, lastName, bornDate, address} = req.body
      const data = {
        email,
        phoneNumber,
        gender,
        username,
        firstName,
        lastName,
        bornDate,
        address,
        photoProfile: `${process.env.BASE_URL}/upload/${req.file.filename}`,
        updatedAt: new Date()
      }
      console.log('data', data)
      usersModels.updateUser(id, data)
      .then(result => {
        const resultUser = result
        response(res, {message: 'Data has been updated'}, {
          status: 'succeed',
          statusCode: 200
          }, null)
      })
      .catch(err => {
          console.log('ini error sql',err)
          const error = new createError(500, 'Looks like server having trouble')
          return next(error)
      })
    },
    sendEmailVerification: async (req, res, next) => {
    const email = req.body.email
    if(!email) {
      const error = new createError(400, `Forbidden: Email cannot be empty. `)
      return next(error)
    }
    try {
      const results = await sendEmail(email)
      return next()
    } catch (error) {
      console.log(error)
      const errorResult = new createError(500, 'Looks like server having trouble')
      return next(errorResult)
    }
  },
  getRoleId: (req, res, next) => {
    const { id } = req.params
    console.log(id)
    usersModels.searchRoleId(id)
    .then(result => {
      response(res, result[0], {
        status: 'succeed',
        statusCode: 200
      }, null)
    })
    .catch(error => {

    })
  },
  forgotPassword: (req, res, next) => {
    const { email } = req.body
    usersModels.checkUsers(email)
      .then((result) => {
        const user = result[0]

        const link = jwt.sign({ userId: user.id, email: user.email }, process.env.ACCESS_TOKEN_KEY, { expiresIn: '1h' })
        response(res, {message: link}, {
          status: 'succeed',
          statusCode: 200
        }, null)
        sendEmailForgotPassword(email, link)
      })
      .catch(() => {
        const errorResult = new createError(404, 'Your email not registered')
        return next(errorResult)
      })
  },
  emailVerification: (req, res, next) => {
    const email = req.body.email
  }
}

module.exports = usersController