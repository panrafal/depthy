'use strict';

angular.module('depthyApp')
.directive('rangeStepper', function ($parse, $timeout, $compile) {
  return {
    restrict: 'A',
    scope: true,
    require: ['rangeStepper', 'ngModel'],
    // template: '<div ng-transclude></div>',
    // transclude: true,
    controller: function() {
    },
    compile: function($element, $attrs) {
      // console.log($element);
      var labelTemplate;
      if (!$element.find('.rs-value, .rs-thumb').length) {
        labelTemplate = $element.html();
        $element.html('');
      }
      return function postLink($scope, $element, $attrs, ctrls) {
        var values = $scope.$parent.$eval($attrs.values),
            options,
            position, defaultFormatter,
            rangeStepper = ctrls[0],
            ngModel = ctrls[1];

        options = angular.extend({
          // snap to defined values - 0.0 - 1.0
          snap: 0.1,
          // step between defined values - 0.0 - 1.0
          step: 0,
          // interpolated values will have this precision
          precision: 0.001,
          labelTemplate: labelTemplate || '{{getLabel(v)}}',
          valuesTemplate: '<div ng-repeat="v in values" class="rs-value"><placeholder /></div>',
          thumbTemplate: '<div class="rs-thumb"><placeholder /></div>',
          format: 0.1,
          units: '',
        }, $scope.$parent.$eval($attrs.rangeStepper) || {});

        if (angular.isFunction(options.format)) {
          defaultFormatter = options.format;
        } else if (angular.isNumber(options.format)) {
          var precision = options.format;
          defaultFormatter = function(v) {
            return precise(v, precision);
          };
        } else if (options.format === '%') {
          defaultFormatter = function(v) {return Math.round(v * 100);};
        // } else if (angular.isString(options.format)) {
          // defaultFormatter = $format(options.format);
        } else {
          defaultFormatter = function(v) {return v;};
        }

        if (!values || values.length < 2) {
          console.error('Values are missing! Expr: %s, evaled to %o', $attrs.values, values);
        }

        function initialize() {
          // setup templates
          if ($element.find('.rs-value').length === 0) {
            $element.append($compile(options.valuesTemplate.replace(/<placeholder\s*\/>/i, options.labelTemplate))($scope));
          }
          if ($element.find('.rs-thumb').length === 0) {
            $element.append($compile(options.thumbTemplate.replace(/<placeholder\s*\/>/i, options.labelTemplate))($scope));
          }
          $timeout(updateValues);
        }

        function precise(v, precision) {
          if (!precision) return v;
          return +(Math.round(v / precision) * precision).toFixed(8);
        }

        function pxToPosition(px) {
          var rect = $element[0].getBoundingClientRect();
          return (px - rect.left) / rect.width * (values.length);
        }

        function positionClamp(pos) {
          return Math.max(0, Math.min( values.length - 1, (pos >> 0) + precise(pos % 1, options.step) ));
        }

        function getValueAt(i) {
          var v = values[Math.max(0, Math.min(values.length - 1, Math.round(i)))];
          return angular.isObject(v) ? v.value : v;
        }

        function getValue(v) {
          return angular.isObject(v) && v.value !== undefined ? v.value : v;
        }

        function getLabel(v, format, units) {
          if (angular.isObject(v)) {
            if (v.label !== undefined) return v.label;
            v = v.value;
          }

          return (format || defaultFormatter)(v) + (units || options.units);
        }

        function interpolate(a, b, t) {
          if (angular.isObject(a)) {
            var result = {};
            for (var k in a) {
              result[k] = interpolate(a[k], b[k], t);
            }
            return result;
          } else {
            return precise(a + (b - a) * t, options.precision);
          }
        }

        function locate(v, a, b) {
          if (angular.isObject(v)) {
            var result = true;
            for (var k in v) {
              var pos = locate(v[k], a[k], b[k]);
              if (pos === false) return false;
              else if (pos !== true) {
                if (result === true || Math.abs(result - pos) < 0.01) {
                  result = pos;
                } else {
                  // console.warn('Partial range!');
                  return false;
                }
              }
            }
            return result;
          } else if (a === b) {
            return v === a;
          } else if (v === a) {
            return 0;
          } else if (v === b) {
            return 1;
          } else {
            return (v - a) / (b - a);
          }
        }

        function equals(a, b) {
          return locate(a, b, b) === true;
        }

        function positionToValue(pos) {
          pos = positionClamp(pos);
          if (options.snap && Math.abs(pos - Math.round(pos)) <= options.snap / 2) pos = Math.round(pos);
          if (pos % 1 === 0) return values[pos];

          var value = getValueAt(Math.floor(pos)),
              next = getValueAt(Math.floor(pos) + 1);
          return {value: interpolate(value, next, pos % 1)};
        }

        function valueToPosition(v) {
          var i = values.indexOf(v);
          if (i >= 0) return i;
          v = getValue(v);
          for (i = 0; i < values.length - 1; ++i) {
            var from = getValueAt(i),
                to = getValueAt(i + 1),
                pos = locate(v, from, to);
            if (pos !== false && pos !== true && pos >= 0 && pos <= 1) {
              return i + pos;
            }
          }
          if (v >= getValueAt(values.length - 1)) return values.length - 1;
          // console.warn('Value %s is out of bounds!', v);
          return false;
        }

        function updateValues() {
          $element.find('.rs-value, .rs-thumb').css('width', (1 / values.length * 100) + '%');
        }

        function setPosition(pos) {
          position = positionClamp(pos);
          $scope.position = position;

          $element.find('.rs-thumb').css('transform', 'translateX('+(position * 100)+'%)');

          if (pos === false) {
            $scope.v = ngModel.$viewValue;
            return;
          }

          var value = positionToValue(position),
              valueValue = getValue(value);

          $scope.v = value;
          // console.log('setPosition pos %s (%s) value %o getValue %o', pos, position, value, valueValue);
          if (!equals(ngModel.$viewValue, valueValue)) {
            ngModel.$setViewValue(valueValue);
          }
        }

        $scope.dragging = false;
        $scope.values = values;

        $scope.getLabel = getLabel;
        $scope.getValue = getValue;

        ngModel.$render = function() {
          setPosition(valueToPosition(ngModel.$viewValue));
        };

        $element.on('mousedown touchstart', '.rs-value', function(event) {
          var pointer = event.originalEvent.touches && event.originalEvent.touches[0] || event;
          if (event.touches && event.touches.length > 1) return;

          event.preventDefault();
          // console.log(event);

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

        // setup API
        rangeStepper.percent = function(p) {
          if (p !== undefined) {
            setPosition(p * (values.length - 1));
          }
          return position / (values.length - 1);
        };


        initialize();

      };
    }
  };
});
