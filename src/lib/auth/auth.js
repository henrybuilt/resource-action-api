const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
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
          //HINT this fixes an encryption bug that breaks password comparison in rails due to a bcrypt issue
          resolve(hash.replace('$2b', '$2a'));
        }
      });
    });
  },

  token: {
    async for({user, shouldExpire = true}) {
      return await new Promise((resolve) => {
        jwt.sign({user: user.id === null ? user : {id: user.id}}, secret, shouldExpire ? {expiresIn: '360d'} : {}, (error, token) => {
          // istanbul ignore if
          if (error) alwaysLog(error);

          resolve(error ? '' : token);
        });
      });
    },

    async dataFor({token}) {
      return await new Promise((resolve, reject) => {
        jwt.verify(token, secret, (error, data) => {
          // istanbul ignore if
          if (error && process.env.NODE_ENV !== 'test') console.log(error);

          error ? reject(error) : resolve(data);
        });
      });
    },

    async userFor({db, token}) {
      var user;

      if (token) {
        var data = await auth.token.dataFor({token});

        if (data.user.id === null) {
          user = data.user;
        }
        else {
          user = await db.get('user', {where: {id: data.user.id}}, {shouldLog: false});
        }
      }

      return user;
    }
  }
};

module.exports = auth;
