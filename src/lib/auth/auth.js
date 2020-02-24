const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const secret = process.env.TOKEN_SECRET;

const auth = {
  passwordMatches({password, user}) {
    return new Promise((resolve) => {
      bcrypt.compare(password, user.encryptedPassword, (error, result) => {
        // istanbul ignore if
        if (error) alwaysLog(error);

        resolve(result === true);
      });
    });
  },

  encryptedPasswordFor({password}) {
    return new Promise((resolve) => {
      bcrypt.hash(password, 10, (error, hash) => {
        if (error) {
          reject(error);
        }
        else {
          resolve(hash);
        }
      });
    });
  },

  token: {
    async for({user}) {
      return await new Promise((resolve) => {
        jwt.sign({user: {id: user.id}}, secret, {expiresIn: '360d'}, (error, token) => {
          // istanbul ignore if
          if (error) alwaysLog(error);

          resolve(error ? '' : token);
        });
      });
    },

    async dataFor({token}) {
      return await new Promise((resolve) => {
        jwt.verify(token, secret, (error, data) => {
          // istanbul ignore if
          if (error && process.env.NODE_ENV !== 'test') console.log(error);

          resolve(error ? {user: {}} : data);
        });
      });
    },

    async userFor({db, token}) {
      var user;

      if (token) {
        var data = await auth.token.dataFor({token});

        user = await db.get('user', {where: {id: data.user.id}}, {shouldLog: false});
      }

      return user;
    }
  }
};

module.exports = auth;
