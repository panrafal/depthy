'use strict';

describe('Directive: pixiview', function () {

  // load the directive's module
  beforeEach(module('depthyApp'));

  var element,
    scope;

  beforeEach(inject(function ($rootScope) {
    scope = $rootScope.$new();
  }));

  it('should make hidden element visible', inject(function ($compile) {
    element = angular.element('<pixiview></pixiview>');
    element = $compile(element)(scope);
    expect(element.text()).toBe('this is the pixiview directive');
  }));
});
