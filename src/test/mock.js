
var mock = {};

mock.userFor = async ({group, props={}}) => {
  if (group === 'admin') props.admin = 1;
  if (group === 'employee') props.level = 2;

  return await test.db.create('user', props);
};

mock.productsWithCategories = async ({quantity=3} = {}) => {
  await test.db.create('topLevelProductCategories', _.times(quantity, i => ({id: i + 1, title: `t${i + 1}`})));
  await test.db.create('middleLevelProductCategories', _.times(quantity, i => ({id: i + 1, title: `m${i + 1}`, parentCategoryId: i + 1})));
  await test.db.create('bottomLevelProductCategories', _.times(quantity, i => ({id: i + 1, title: `b${i + 1}`, parentCategoryId: i + 1})));

  return await test.db.create('products', _.times(quantity, i => ({id: i + 1, title: `product${i + 1}`, categoryId: i + 1})));
};

module.exports = mock;
