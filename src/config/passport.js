import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { jwtSecret } from './vars';
import { User } from '../api/models';

const jwtOptions = {
  secretOrKey: jwtSecret,
  jwtFromRequest: ExtractJwt.fromAuthHeaderWithScheme('Bearer'),
};

const jwtHandler = async (payload, done) => {
  try {
    const user = await User.findOne({ _id: payload.sub }).exec();
    if (user) return done(null, user);
    return done(null, false);
  } catch (error) {
    return done(error, false);
  }
};

export const jwt = new JwtStrategy(jwtOptions, jwtHandler);

export default {};

