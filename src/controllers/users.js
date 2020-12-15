const bcrypt = require('bcrypt')
const { v4: uuidv4 } = require('uuid')
const jwt = require('jsonwebtoken')
const usersModels = require('../models/users')
const { response } = require('../helpers/helpers')
const createError = require('http-errors')

const usersController = {
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
                        //   response(res, {message: 'Register Succes'}, 200, null)
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
                
            // jsonwebtoken
            jwt.sign({ userID: user.id, email: user.email }, process.env.ACCESS_TOKEN_KEY, { expiresIn: '1h' }, function (err, token) {
                user.token = token
                return response(res, user, {
                    status: 'succeed',
                    statusCode: 200
                  }, null)
            })
        })
    })
    }
}

module.exports = usersController