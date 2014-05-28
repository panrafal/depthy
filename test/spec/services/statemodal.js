'use strict';

describe('Service: Statemodal', function () {

  // load the service's module
  beforeEach(module('depthyApp'));

  // instantiate service
  var Statemodal;
  beforeEach(inject(function (_Statemodal_) {
    Statemodal = _Statemodal_;
  }));

  it('should do something', function () {
    expect(!!Statemodal).toBe(true);
  });

});
