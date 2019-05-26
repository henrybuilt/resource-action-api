var {helpersFor} = require('./middleware');

describe('middleware', () => {
  describe('helpersFor', () => {
    describe('shouldInclude', () => {
      it('should return true when included item is in array', () => {
        var {shouldInclude} = helpersFor({originalParams: {include: ['a', {b: {}}]}});

        expect(shouldInclude('a')).to.equal(true);
        expect(shouldInclude('b')).to.equal(true);
        expect(shouldInclude('c')).to.equal(false);
      });
    });
  });
});
