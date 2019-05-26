describe('db', () => {
  describe('actions', () => {
    describe('create & get', () => {
      it('should properly respond with default values', async () => {
        var mediumViaCreate = await test.db.create('medium', {id: 1});
        var mediumViaGet = await test.db.get('medium', {where: {id: 1}});

        expect(mediumViaCreate.associations).to.deep.equal({});
        expect(mediumViaGet.associations).to.deep.equal({});

      });

      it('should not include undefined/null properties', async () => {
        var product = await test.db.create('product', {id: 1});

        expect(_.keys(product).length).to.deep.equal(5);
      });
    });
  });
});
