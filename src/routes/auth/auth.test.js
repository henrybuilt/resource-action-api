describe('auth', () => {
  describe('POST /auth/token', () => {
    var tokenRequest = (params) => request({uri: '/auth/token', params});

    beforeEach(async () => {
      user = await test.db.create('user', {
        email: 'masketball0@gmail.com',
        encryptedPassword: '$2a$10$.4mib8dE/ZNQRjNnACuF0OwIhIgUfUk8cB.T.G0fMEv/D6cG.v2yC'
      });
    });

    it('should respond with a token given a valid email and password', async () => {
      var {body} = await tokenRequest({email: "masketball0@gmail.com", password: "test"});

      expect(body.success).to.equal(true);
      expect(body.data.token).not.to.equal(undefined);
    });

    it('should respond with "success": false when user is not valid', async () => {
      var {body} = await tokenRequest({email: "masketball0@gmail", password: "test"});

      expect(body.success).to.equal(false);
      expect(body.data.token).to.equal(undefined);
      expect(body.errors[0].message).to.equal('User not found');
    });

    it('should respond with "success": false when password is wrong', async () => {
      var {body} = await tokenRequest({email: "masketball0@gmail.com", password: "t"});

      expect(body.success).to.equal(false);
      expect(body.data.token).to.equal(undefined);
      expect(body.errors[0].message).to.equal('Incorrect password');
    });
  });
});
