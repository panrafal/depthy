'use strict';

angular.module('depthyApp')
.directive('rangeStepper', function ($parse, $timeout, $compile) {
  return {
    restrict: 'A',
    scope: true,
    require: 'ngModel',
    link: function postLink($scope, $element, $attrs, ngModel) {
      var values = $scope.$parent.$eval($attrs.values),
          options,
          position;
      
      options = angular.extend({
        snap: 0.1,
        valuesTemplate: '<div ng-repeat="v in values" class="rs-value">{{getLabel(v)}}</div>',
        thumbTemplate: '<div class="rs-thumb">{{getLabel(current)}}</div>',
        format: function(v) {return Math.round(v * 100) / 100;}
      }, $scope.$parent.$eval($attrs.rangeStepper) || {});

      if (!values || values.length < 2) {
        console.error('Values are missing! Expr: %s, evaled to %o', $attrs.values, values);
      }

      function initialize() {
        // setup templates
        if ($element.find('.rs-value').length === 0) {
          $element.append($compile(options.valuesTemplate)($scope));
        }
        if ($element.find('.rs-thumb').length === 0) {
          $element.append($compile(options.thumbTemplate)($scope));
        }
        $timeout(updateValues);
      }

      function pxToPosition(px) {
        var rect = $element[0].getBoundingClientRect();
        return (px - rect.left) / rect.width * (values.length);
      }

      function positionClamp(pos) {
        return Math.max(0, Math.min( values.length - 1, pos ));
      }

      function getValueAt(i) {
        var v = values[Math.max(0, Math.min(values.length - 1, Math.round(i)))];
        return angular.isObject(v) ? v.value : v;
      }

      function getValue(v) {
        return angular.isObject(v) ? v.value : v;
      }

      function getLabel(v) {
        return angular.isObject(v) ? v.label || options.format(v.value) : options.format(v);
      }

      function positionToValue(pos) {
        pos = positionClamp(pos);
        if (options.snap && Math.abs(pos - Math.round(pos)) <= options.snap / 2) pos = Math.round(pos);
        if (pos % 1 === 0) return values[pos];

        var value = getValueAt(Math.floor(pos)),
            next = getValueAt(Math.floor(pos) + 1);
        return value + (next - value) * (pos % 1);
      }

      function valueToPosition(v) {
        var i = values.indexOf(v);
        if (i >= 0) return i;
        v = getValue(v);
        for (i = 0; i < values.length - 1; ++i) {
          var from = getValueAt(i),
              to = getValueAt(i + 1);
          if (v >= from && (v < to)) {
            return i + (v - from) / (to - from);
          }
        }
        if (v >= getValueAt(values.length - 1)) return values.length - 1;
        console.warn('Value %s is out of bounds!', v);
        return 0;
      }

      function updateValues() {
        $element.find('.rs-value, .rs-thumb').css('width', (1 / values.length * 100) + '%');
      }

      function setPosition(pos) {
        pos = positionClamp(pos);
        position = pos;
        $element.find('.rs-thumb').css('transform', 'translateX('+(position * 100)+'%)');

        var value = positionToValue(pos);
        $scope.current = value;
        $scope.value = getValue(value);
        console.log('setPosition', pos, $scope.value, value);
        if (ngModel.$viewValue !== $scope.value) {
          ngModel.$setViewValue($scope.value);
        }
      }

      $scope.dragging = false;
      $scope.values = values;

      $scope.getLabel = getLabel;

      ngModel.$render = function() {
        setPosition(valueToPosition(ngModel.$viewValue));
      };

      $element.on('mousedown touchstart', '.rs-value', function(event) {
        var pointer = event.originalEvent.touches && event.originalEvent.touches[0] || event;
        if (event.touches && event.touches.length > 1) return;

        event.preventDefault();
        console.log(event);

        setPosition(Math.floor(positionClamp( pxToPosition(pointer.pageX) )));
        $scope.$apply();
      });

      $element.on('mousedown touchstart', '.rs-thumb', function(event) {
        var pointer = event.originalEvent.touches && event.originalEvent.touches[0] || event;
        if (event.touches && event.touches.length > 1) return;

        event.preventDefault();
        if ($scope.dragging) return;

        $scope.dragging = true;
        $element.addClass('rs-dragging');
        var dragPos = pxToPosition(pointer.pageX),
            onMove = function(event) {
              var pointer = event.originalEvent.touches && event.originalEvent.touches[0] || event;
              event.preventDefault();
              var newPos = pxToPosition(pointer.pageX);
              setPosition( positionClamp( position + newPos - dragPos ));
              dragPos = newPos;
              $scope.$apply();
            },
            onEnd = function(event) {
              event.preventDefault();
              $scope.dragging = false;
              $element.removeClass('rs-dragging');
              $('body').off('mousemove touchmove', onMove)
                .off('mouseup touchend', onEnd);
              $timeout(function() {
                setPosition( valueToPosition(positionToValue(position)) );
              });
              $scope.$apply();
            };

        $('body').on('mousemove touchmove', onMove)
          .on('mouseup touchend', onEnd);

      });


      initialize();

    }
  };
});
