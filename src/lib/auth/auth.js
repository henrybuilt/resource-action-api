const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const secret = process.env.HENRYBUILT_API_TOKEN_SECRET;

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
          if (error) log(error);

          resolve(error ? {user: {}} : data);
        });
      });
    },

    async userFor({db, token}) {
      var data = await auth.token.dataFor({token});
      var user = await db.get('user', {where: {id: data.user.id}}, {shouldLog: false});

      return user;
    }
  }
};

module.exports = auth;
