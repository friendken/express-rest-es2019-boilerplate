import crypto from 'crypto';
import moment from 'moment-timezone';

/**
 * Generate a refresh token object and saves it into the database
 *
 * @param {User} user
 * @returns {RefreshToken}
 */

function generate(user) {
  const userId = user._id;
  const userEmail = user.email;
  const token = `${userId}.${crypto.randomBytes(40).toString('hex')}`;
  const expires = moment().add(30, 'days').toDate();
  const tokenObject = new this({
    token, userId, userEmail, expires,
  });
  tokenObject.save();
  return tokenObject;
}

export default function (schema) {
  // eslint-disable-next-line no-param-reassign
  schema.statics = {
    ...this,
    generate,
  };
}
