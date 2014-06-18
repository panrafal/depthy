'use strict';

describe('GDepthEncoder', function () {

  var xmpDataURI = 'data:image/jpeg;base64,/9j/4QAqRXhpZgAASUkqAAgAAAABAJiCAgAFAAAAGgAAAAAAAABUZXN0AAAAAP/sABFEdWNreQABAAQAAABLAAD/4QSkaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLwA8P3hwYWNrZXQgYmVnaW49Iu+7vyIgaWQ9Ilc1TTBNcENlaGlIenJlU3pOVGN6a2M5ZCI/PiA8eDp4bXBtZXRhIHhtbG5zOng9ImFkb2JlOm5zOm1ldGEvIiB4OnhtcHRrPSJBZG9iZSBYTVAgQ29yZSA1LjUtYzAyMSA3OS4xNTQ5MTEsIDIwMTMvMTAvMjktMTE6NDc6MTYgICAgICAgICI+IDxyZGY6UkRGIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyI+IDxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PSIiIHhtbG5zOnhtcFJpZ2h0cz0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL3JpZ2h0cy8iIHhtbG5zOnhtcE1NPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvbW0vIiB4bWxuczpzdFJlZj0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL3NUeXBlL1Jlc291cmNlUmVmIyIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iIHhtcFJpZ2h0czpNYXJrZWQ9IlRydWUiIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDo2ZWJlYzg1YS1kODBmLWMxNGYtYWY3ZC1hZGMzN2M0ZTQwYTciIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6ODc3NjlBMzNGNThFMTFFM0EwNzhCNTg4QTI3MThFNzkiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6ODc3NjlBMzJGNThFMTFFM0EwNzhCNTg4QTI3MThFNzkiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENDIChXaW5kb3dzKSI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOjZlYmVjODVhLWQ4MGYtYzE0Zi1hZjdkLWFkYzM3YzRlNDBhNyIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDo2ZWJlYzg1YS1kODBmLWMxNGYtYWY3ZC1hZGMzN2M0ZTQwYTciLz4gPGRjOnJpZ2h0cz4gPHJkZjpBbHQ+IDxyZGY6bGkgeG1sOmxhbmc9IngtZGVmYXVsdCI+VGVzdDwvcmRmOmxpPiA8L3JkZjpBbHQ+IDwvZGM6cmlnaHRzPiA8ZGM6dGl0bGU+IDxyZGY6QWx0PiA8cmRmOmxpIHhtbDpsYW5nPSJ4LWRlZmF1bHQiPlRlc3Q8L3JkZjpsaT4gPC9yZGY6QWx0PiA8L2RjOnRpdGxlPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/Pv/tAFBQaG90b3Nob3AgMy4wADhCSU0EBAAAAAAAGBwBWgADGyVHHAIAAAIAAhwCdAAEVGVzdDhCSU0EJQAAAAAAEN5W4ZqfXiPJ8CAePrIPGv//7gAOQWRvYmUAZMAAAAAB/9sAhAADAgICAgIDAgIDBQMDAwUFBAMDBAUGBQUFBQUGCAYHBwcHBggICQoKCgkIDAwMDAwMDg4ODg4QEBAQEBAQEBAQAQMEBAYGBgwICAwSDgwOEhQQEBAQFBEQEBAQEBEREBAQEBAQERAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAAgACADAREAAhEBAxEB/8QASwABAQAAAAAAAAAAAAAAAAAAAAkBAQAAAAAAAAAAAAAAAAAAAAAQAQAAAAAAAAAAAAAAAAAAAAARAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AKpgAAAAAAAAAAAAAAA//9k=';
  var simpleDataURI = 'data:image/jpeg;base64,/9j/4QAqRXhpZgAASUkqAAgAAAABAJiCAgAFAAAAGgAAAAAAAABUZXN0AAAAAP/sABFEdWNreQABAAQAAABLAAD/7QAsUGhvdG9zaG9wIDMuMAA4QklNBCUAAAAAABAAAAAAAAAAAAAAAAAAAAAA/+4ADkFkb2JlAGTAAAAAAf/bAIQAAwICAgICAwICAwUDAwMFBQQDAwQFBgUFBQUFBggGBwcHBwYICAkKCgoJCAwMDAwMDA4ODg4OEBAQEBAQEBAQEAEDBAQGBgYMCAgMEg4MDhIUEBAQEBQREBAQEBARERAQEBAQEBEQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQ/8AAEQgAIAAgAwERAAIRAQMRAf/EAEsAAQEAAAAAAAAAAAAAAAAAAAAJAQEAAAAAAAAAAAAAAAAAAAAAEAEAAAAAAAAAAAAAAAAAAAAAEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCVQAAAAAAAAAAAAAAAP//Z';

  var longDataURI = 'data:image/jpeg;base64,';
  for (var i = 0; i < 1600; ++i) {
    longDataURI += 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  }

  it('should build XMP', function () {
    var xmp = GDepthEncoder.buildXMP({test: 'TEST!'});
    expect(xmp).toMatch(/^<x:xmpmeta .+ xmlns:GFocus="http.+test="TEST!".+<\/x:xmpmeta>$/);
  });

  it('should understand dataURI', function() {
    var info = GDepthEncoder.dataURIinfo(xmpDataURI);
    expect(info.mime).toBe('image/jpeg');
    expect(info.data).not.toBe(null);
    expect(info.data.length).toBeGreaterThan(500);
  });

  it('should accept only ArrayBuffer', function () {
    expect(function() { GDepthEncoder.encodeDepthmap([1,2,3]); }).toThrow();
  });

  it('should encode image', function () {
    var result = GDepthEncoder.encodeDepthmap(dataURItoArrayBuffer(xmpDataURI).buffer, longDataURI, simpleDataURI);

    expect(result.type).toBe('image/jpeg');
    expect(result.size).toBeGreaterThan(1500);

    var dr = null, parsed = false, loaded = false;
    runs(function() {
      var fr = new FileReader();
      fr.onload = function() {
        dr = new DepthReader();
        dr.parseFile(fr.result, function() {
          // console.log(dr);
          parsed = true;
        });
      };
      fr.readAsArrayBuffer(result);
    });

    waitsFor(function() {
      return parsed;
    }, 'Result should be parsed', 100);

    runs(function() {
      expect(dr.depth.mime).toBe('image/jpeg');
      // expect(dr.depth.data).toBe(GDepthEncoder.dataURIinfo(longDataURI).data);
      expect(dr.depth.data.length).toEqual(longDataURI.length - 23);
      expect(dr.image.mime).toBe('image/jpeg');
      expect(dr.image.data).toBe(GDepthEncoder.dataURIinfo(simpleDataURI).data);
    });

    runs(function() {
      var img = document.createElement('img');

      img.onload = function() {
        loaded = {w:img.width, h:img.height};
      };
      img.src = URL.createObjectURL(result);
    });

    waitsFor(function() {
      return loaded;
    }, 'Result should be loadable', 100);

    runs(function() {
      expect(loaded).toEqual({w:32, h:32});
    });

    console.log('Encoded: %d / %s', result.size, result.type, result);
    // expect(xmp).toMatch(/^<x:xmpmeta .+ xmlns:GFocus="http.+test="TEST!".+<\/x:xmpmeta>$/);
  });
});
