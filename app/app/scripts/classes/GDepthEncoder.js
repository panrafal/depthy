/*
The MIT License

Copyright (c) 2014 Rafał Lindemann. http://panrafal.github.com/depthy
*/
(function() {
  'use strict';

  function makeUint16Buffer(arr, littleEndian) {
    var ab = new ArrayBuffer(arr.length * 2),
        dv = new DataView(ab);
    for (var i = 0; i < arr.length; ++i) {
      dv.setUint16(i * 2, arr[i], littleEndian);
    }
    return new Uint8Array(ab);
  }

  function makeUint32Buffer(arr, littleEndian) {
    var ab = new ArrayBuffer(arr.length * 4),
        dv = new DataView(ab);
    for (var i = 0; i < arr.length; ++i) {
      dv.setUint32(i * 4, arr[i], littleEndian);
    }
    return new Uint8Array(ab);
  }

  window.GDepthEncoder = {

    xmlns: {
      'GFocus': 'http://ns.google.com/photos/1.0/focus/',
      'GImage': 'http://ns.google.com/photos/1.0/image/',
      'GDepth': 'http://ns.google.com/photos/1.0/depthmap/',
      'xmpNote': 'http://ns.adobe.com/xmp/note/',
    },
    xmpHeader: 'http://ns.adobe.com/xap/1.0/',
    xmpExtensionHeader: 'http://ns.adobe.com/xmp/extension/',

    // This is NOT a general purpose XMP builder!
    buildXMP: function(props, xmlns) {
      var xmp = [], k;
      xmlns = xmlns || this.xmlns;
      xmp.push('<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Adobe XMP Core 5.1.0-jc003">');
      xmp.push('<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">');
      xmp.push('<rdf:Description rdf:about=""');
      for (k in xmlns) {
        xmp.push(' xmlns:', k, '="', xmlns[k], '"');
      }
      for (k in props) {
        // TODO html entities escaping
        xmp.push(' ', k, '="' + props[k] + '"');
      }
      xmp.push(' /></rdf:RDF></x:xmpmeta>');
      return xmp.join('');
    },

    dataURIinfo: function(uri) {
      var match = uri.match(/^data:(.+?);(.+?),(.+)$/);
      return match ? {
        mime: match[1],
        encoding: match[2],
        data: match[3]
      } : null;
    },

    /**
    @param ArrayBuffer buffer image JPG as an ArrayBuffer
    @param dataURI depthmap
    @param dataURI original
    */
    encodeDepthmap: function(buffer, depthmap, original, metadata) {
      var props = {}, extProps = {}, standardXMP, extendedXMP;
      depthmap = this.dataURIinfo(depthmap || '');
      original = this.dataURIinfo(original || '');
      if (original) {
        props['GImage:Mime'] = original.mime;
        extProps['GImage:Data'] = original.data;
        console.log('Original size', original.data.length);
      }
      if (depthmap) {
        props['GDepth:Format'] = 'RangeInverse';
        props['GDepth:Mime'] = depthmap.mime;
        extProps['GDepth:Data'] = depthmap.data;
        console.log('Depthmap size', depthmap.data.length);
      }
      for (var k in metadata || {}) {
        props[k] = metadata[k];
      }
      standardXMP = this.buildXMP(props);
      extendedXMP = this.buildXMP(extProps);

      return this.encodeXMP(buffer, standardXMP, extendedXMP);
    },

    encodeXMP: function(buffer, standardXMP, extendedXMP) {
      var data = new DataView(buffer),
          offset = 0,
          parts = [],
          xmpWritten = false,
          self = this;

      function writeXMP() {
        if (!xmpWritten) {
          parts.push.apply(parts, self.buildXMPsegments(standardXMP, extendedXMP));
          console.log('XMP written!');
          xmpWritten = true;
        }
      }

      while (offset < data.byteLength) {
        var segType, segSize, app1Header, segStart, b;
        segStart = offset;
        console.log('Offset ' + offset);
        if ((b = data.getUint8(offset++)) !== 0xFF) {
          throw 'Bad JPG Format, 0xFF expected, got ' + b;
        }
        do {
          segType = data.getUint8(offset++);
          if (segType === 0xFF) {
            console.log('Padding 0xFF found');
            parts.push(new Uint8Array([0xFF]));
          } else break;
        } while (true);
        if (segType === 0xC0 || segType === 0xC2 || segType === 0xDA) {
          writeXMP(); // right before SOF / SOS
        }
        if (segType === 0xDA) {
          // copy the rest on SOS... no XMP should exist beyound that point
          console.log('SOS found, copy remaining bytes ' + (buffer.byteLength - segStart));
          parts.push(new Uint8Array(buffer, segStart, buffer.byteLength - segStart));
          break;
        }
        if (segType === 0x00 || (segType >= 0xD0 && segType <= 0xD9)) {
          parts.push(new Uint8Array(buffer, segStart, 2));
          console.log('Found ctrl segment ' + segType);
          continue;
        }
        segSize = data.getUint16(offset);
        offset += 2;
        if (segType === 0xE1) {
          // read header
          app1Header = '';
          while ((b = data.getUint8(offset++)) !== 0x0) {
            app1Header += String.fromCharCode(b);
          }
          console.log('Found APP1 ' + app1Header);
          // ignore any existing XMP
          if (app1Header === this.xmpHeader || app1Header === this.xmpExtensionHeader) {
            console.log('Found old XMP, skipping');
            offset += segSize - (offset - segStart - 2);
            continue;
          }
        }
        // copying segment
        console.log('Copying segment ' + segType + ', size: ' + segSize + ', left:' + (segSize - (offset - segStart - 2)));
        offset += segSize - (offset - segStart - 2);
        parts.push(new Uint8Array(buffer, segStart, 2 + segSize));
        if (segType === 0xE1) {
          writeXMP(); // right after EXIF
        }
      }
      // console.log('Parts', parts);
      return new Blob(parts, {type: 'image/jpeg'});
    },

    buildXMPsegments: function(standardXMP, extendedXMP) {
      var extendedUid, parts = [];
      if (extendedXMP) {
        extendedUid = CryptoJS.MD5(extendedXMP).toString().toUpperCase();
        console.log('ExtendedUID', extendedUid);
        standardXMP = standardXMP.replace(/(<rdf:Description) /, '$1 xmpNote:HasExtendedXMP="' + extendedUid + '" ');
      }
      console.log('StandardXMP: ', standardXMP.length);
      console.log('ExtendedXMP: ', extendedXMP.length);
      // console.log('ExtendedXMP: "%s"', extendedXMP);

      parts.push(new Uint8Array([0xFF, 0xE1]));
      parts.push(makeUint16Buffer([2 + this.xmpHeader.length + 1 + standardXMP.length]));
      parts.push(this.xmpHeader, new Uint8Array([0x00]));
      parts.push(standardXMP);
      console.log('Written standardXMP');
      if (extendedXMP) {
        var offset = 0;
        while (offset < extendedXMP.length) {
          var chunkSize = Math.min(65383, extendedXMP.length - offset);
          parts.push(new Uint8Array([0xFF, 0xE1]));
          parts.push(makeUint16Buffer([2 + this.xmpExtensionHeader.length + 1 + 32 + 4 + 4 + chunkSize]));
          parts.push(this.xmpExtensionHeader, new Uint8Array([0x00]));
          parts.push(extendedUid, makeUint32Buffer([extendedXMP.length, offset]));
          parts.push(extendedXMP.substr(offset, chunkSize));

          console.log('Written extendedXMP chunk %d %db of %d', offset, chunkSize, extendedXMP.length);
          offset += chunkSize;
        }
      }
      return parts;
    },

  };

})();