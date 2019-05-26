var productCategoryPseudoResource = require('./product-category');

describe('pseudo resource: product category', () => {
  describe('get', () => {
    it('should return an array of {id, title} sorted by rank', async () => {
      await test.db.create('topLevelProductCategory', {id: 1, title: 't1', rank:1});
      await test.db.create('topLevelProductCategory', {id: 2, title: 't2', rank:2});
      await test.db.create('topLevelProductCategory', {id: 3, title: 't3', rank:0});
      await test.db.create('middleLevelProductCategory', {id: 1, title: 'm1', parentCategoryId: 1, rank:1});
      await test.db.create('middleLevelProductCategory', {id: 2, title: 'm2', parentCategoryId: 2, rank:2});
      await test.db.create('middleLevelProductCategory', {id: 3, title: 'm3', parentCategoryId: 3, rank:1});
      await test.db.create('middleLevelProductCategory', {id: 4, title: 'm4', parentCategoryId: 3, rank:3});
      await test.db.create('bottomLevelProductCategory', {id: 1, title: 'b1', parentCategoryId: 1, rank:2});
      await test.db.create('bottomLevelProductCategory', {id: 2, title: 'b2', parentCategoryId: 2, rank:1});
      await test.db.create('bottomLevelProductCategory', {id: 3, title: 'b3', parentCategoryId: 3, rank:3});
      await test.db.create('bottomLevelProductCategory', {id: 4, title: 'b4', parentCategoryId: 4, rank:3});
      await test.db.create('bottomLevelProductCategory', {id: 5, title: 'b5', parentCategoryId: 4, rank:1});

      var {execute} = productCategoryPseudoResource.actions.get;

      var productCategories = await execute({db: test.db});

      expect(productCategories.length).to.equal(5);
      expect(_.map(productCategories, 'id')).to.deep.equal([3, 5, 4, 1, 2]);
      expect(_.map(productCategories, 'title')).to.deep.equal([
        't3 > m3 > b3',
        't3 > m4 > b5',
        't3 > m4 > b4',
        't1 > m1 > b1',
        't2 > m2 > b2'
      ]);
    });
  });
});
