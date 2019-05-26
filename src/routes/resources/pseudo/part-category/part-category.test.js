var partCategoryPseudoResource = require('./part-category');

describe('pseudo resource: part category', () => {
  describe('get', () => {
    it('should return an array of id and generated title', async () => {
      await test.db.create('allPartCategory', {id: 1, title: 't1', parentCategoryId: -1});
      await test.db.create('allPartCategory', {id: 2, title: 't2', parentCategoryId: -1});
      await test.db.create('allPartCategory', {id: 3, title: 'm1', parentCategoryId: 1});
      await test.db.create('allPartCategory', {id: 4, title: 'm2', parentCategoryId: 2});
      await test.db.create('allPartCategory', {id: 5, title: 'm3', parentCategoryId: 2});

      var {execute} = partCategoryPseudoResource.actions.get;
      var bottomLevelCategories = await execute({db: test.db});

      expect(bottomLevelCategories.length).to.equal(3);
      expect(_.map(bottomLevelCategories, 'title')).to.deep.equal([
        't1 > m1',
        't2 > m2',
        't2 > m3',
      ]);
    });
  });
});
