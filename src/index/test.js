describe('app', () => {
  describe('get to "/status"', () => {
    it('it should respond with {success: true}', async () => {
      var {body} = await request({uri: '/status', method: 'get'});

      expect(body.success).to.equal(true);
    });
  });
});
