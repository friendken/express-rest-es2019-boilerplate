import mongoose from 'mongoose';
import httpStatus from 'http-status';
import { omitBy, isNil } from 'lodash';
import bcrypt from 'bcryptjs';
import moment from 'moment-timezone';
import jwt from 'jwt-simple';
import uuidv4 from 'uuid/v4';
import APIError from '../../utils/APIError';
import { env, jwtSecret, jwtExpirationInterval } from '../../../config/vars';

/**
* User Roles
*/
export const roles = ['user', 'admin'];

/**
 * Add your
 * - pre-save hooks
 * - validations
 * - virtuals
 */

async function preSave(next) {
  try {
    if (!this.isModified('password')) return next();

    const rounds = env === 'test' ? 1 : 10;

    const hash = await bcrypt.hash(this.password, rounds);
    this.password = hash;

    return next();
  } catch (error) {
    return next(error);
  }
}

/**
 * Methods
 */
function transform() {
  const transformed = {};
  const fields = ['id', 'name', 'email', 'picture', 'role', 'createdAt'];

  fields.forEach((field) => {
    transformed[field] = this[field];
  });

  return transformed;
}

function token() {
  const playload = {
    exp: moment().add(jwtExpirationInterval, 'minutes').unix(),
    iat: moment().unix(),
    sub: this._id,
  };
  return jwt.encode(playload, jwtSecret);
}

async function passwordMatches(password) {
  return bcrypt.compare(password, this.password);
}

/**
 * Statics
 */


/**
 * Get user
 *
 * @param {ObjectId} id - The objectId of user.
 * @returns {Promise<User, APIError>}
 */
async function get(id) {
  try {
    let user;

    if (mongoose.Types.ObjectId.isValid(id)) {
      user = await this.findById(id).exec();
    }
    if (user) {
      return user;
    }

    throw new APIError({
      message: 'User does not exist',
      status: httpStatus.NOT_FOUND,
    });
  } catch (error) {
    throw error;
  }
}

/**
 * Find user by email and tries to generate a JWT token
 *
 * @param {ObjectId} id - The objectId of user.
 * @returns {Promise<User, APIError>}
 */
async function findAndGenerateToken(options) {
  const { email, password, refreshObject } = options;
  if (!email) throw new APIError({ message: 'An email is required to generate a token' });

  const user = await this.findOne({ email }).exec();
  const err = {
    status: httpStatus.UNAUTHORIZED,
    isPublic: true,
  };
  if (password) {
    if (user && await user.passwordMatches(password)) {
      return { user, accessToken: user.token() };
    }
    err.message = 'Incorrect email or password';
  } else if (refreshObject && refreshObject.userEmail === email) {
    if (moment(refreshObject.expires).isBefore()) {
      err.message = 'Invalid refresh token.';
    } else {
      return { user, accessToken: user.token() };
    }
  } else {
    err.message = 'Incorrect email or refreshToken';
  }
  throw new APIError(err);
}

/**
 * List users in descending order of 'createdAt' timestamp.
 *
 * @param {number} skip - Number of users to be skipped.
 * @param {number} limit - Limit number of users to be returned.
 * @returns {Promise<User[]>}
 */
function list({
  page = 1, perPage = 30, name, email, role,
}) {
  const options = omitBy({ name, email, role }, isNil);

  return this.find(options)
    .sort({ createdAt: -1 })
    .skip(perPage * (page - 1))
    .limit(perPage)
    .exec();
}

/**
 * Return new validation error
 * if error is a mongoose duplicate key error
 *
 * @param {Error} error
 * @returns {Error|APIError}
 */
function checkDuplicateEmail(error) {
  if (error.name === 'MongoError' && error.code === 11000) {
    return new APIError({
      message: 'Validation Error',
      errors: [{
        field: 'email',
        location: 'body',
        messages: ['"email" already exists'],
      }],
      status: httpStatus.CONFLICT,
      isPublic: true,
      stack: error.stack,
    });
  }
  return error;
}

async function oAuthLogin({
  service, id, email, name, picture,
}) {
  const user = await this.findOne({ $or: [{ [`services.${service}`]: id }, { email }] });
  if (user) {
    user.services[service] = id;
    if (!user.name) user.name = name;
    if (!user.picture) user.picture = picture;
    return user.save();
  }
  const password = uuidv4();
  return this.create({
    services: { [service]: id }, email, password, name, picture,
  });
}

export default function (schema) {
  // eslint-disable-next-line no-param-reassign
  schema.statics = {
    roles,
    ...this,
    get,
    findAndGenerateToken,
    list,
    checkDuplicateEmail,
    oAuthLogin,
  };
  schema.method({
    ...this,
    transform,
    token,
    passwordMatches,
  });
  schema.pre('save', preSave);
}
