(function() {
  'use strict';
  Modernizr.addTest('ios', /iPad|iPhone|iPod/.test(window.navigator.userAgent));
  Modernizr.addTest('android', /Android/i.test(window.navigator.userAgent));
  Modernizr.addTest('winphone', /IEMobile/i.test(window.navigator.userAgent));
  Modernizr.addTest('mobile', /iPad|iPhone|iPod|Android|IEMobile/.test(window.navigator.userAgent));
  Modernizr.addTest('ff', /Firefox/.test(window.navigator.userAgent));
  Modernizr.addTest('ie', /; MSIE/.test(window.navigator.userAgent));
  Modernizr.addTest('chrome', /\bChrome\b/.test(window.navigator.userAgent));
  Modernizr.addTest('safari', /\bSafari\b/.test(window.navigator.userAgent) && !/\bChrome\b/.test(window.navigator.userAgent));
})();
