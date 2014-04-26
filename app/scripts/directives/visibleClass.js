'use strict';

angular.module('visibleClass', [])
.factory('VisibleClassService', function ($window) {
  var targets = [];

  function doUpdate() {
    var $container = $($window),
      scrollTop = 0, // $container.scrollTop(),
      scrollHeight = $container.height(),
      scrollBottom = scrollTop + scrollHeight,
      pos, visible;


    _.each(targets, function(item) {
      pos = item.el[0].getBoundingClientRect();
      // if (item.el[0].className.match(/hide(?: |$)/)) return;
      visible = pos.top < scrollBottom && pos.bottom > scrollTop;

      if (item.v !== visible) {
        if (visible) {
          if (item.cls) item.el.addClass(item.cls);
          if (item.func) item.func(visible);
          item.v = visible;
        } else if (!item.sticky) {
          if (item.cls) item.el.removeClass(item.cls);
          if (item.func) item.func(visible);
          item.v = visible;
        }
      }
    });
  }

  $($window).on('scroll', function() {
    doUpdate();
  });


  var svc = {
    addTarget: function(tgt) {
      targets.push(tgt);
    },
    doUpdate: doUpdate,
    update: _.throttle(doUpdate, 25)
  };

  return svc;
})
.directive('visibleClass', function (VisibleClassService) {
  return {
    restrict: 'A',
    link: function postLink($scope, $element, $attrs) {
      VisibleClassService.addTarget({
        el: $element,
        cls: $attrs.visibleClass,
      });
    }
  };
})
.directive('shownClass', function (VisibleClassService) {
  return {
    restrict: 'A',
    link: function postLink($scope, $element, $attrs) {
      VisibleClassService.addTarget({
        el: $element,
        cls: $attrs.shownClass,
        sticky: true,
      });
    }
  };
})
.directive('shownEval', function (VisibleClassService) {
  return {
    restrict: 'A',
    link: function postLink($scope, $element, $attrs) {
      var expr = $attrs.shownEval;
      VisibleClassService.addTarget({
        el: $element,
        func: function(visible) { $scope.$eval(expr, {'$visible': visible}); $scope.$apply(); },
        sticky: true,
      });
    }
  };
});
