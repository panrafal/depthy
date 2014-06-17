/*
The MIT License

Copyright (c) 2014 Rafał Lindemann. http://panrafal.github.com/depthy
*/
(function() {
  'use strict';

  /*

<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Adobe XMP Core 5.1.0-jc003"> <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"> 
<rdf:Description rdf:about="" 
  xmlns:GFocus="http://ns.google.com/photos/1.0/focus/" 
  xmlns:GImage="http://ns.google.com/photos/1.0/image/" 
  xmlns:GDepth="http://ns.google.com/photos/1.0/depthmap/" 
  xmlns:xmpNote="http://ns.adobe.com/xmp/note/" 
  GFocus:BlurAtInfinity="0.02976035" 
  GFocus:FocalDistance="9.569768" 
  GFocus:FocalPointX="0.512963" GFocus:FocalPointY="0.49999997" 
  GImage:Mime="image/jpeg" 
  GDepth:Format="RangeInverse" 
  GDepth:Near="6.2360944747924805" 
  GDepth:Far="19.068166732788086" 
  GDepth:Mime="image/png" 
  xmpNote:HasExtendedXMP="420161059863C43993D79FBDFA80C997"/> </rdf:RDF> </x:xmpmeta>

<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Adobe XMP Core 5.1.0-jc003"> 
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"> 
    <rdf:Description rdf:about="" xmlns:GImage="http://ns.google.com/photos/1.0/image/" xmlns:GDepth="http://ns.google.com/photos/1.0/depthmap/" 
      GImage:Data="/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA...==" 
      GDepth:Data="iVBORw0KGgoAAAANSUhEUg...C"/> 
    </rdf:RDF> </x:xmpmeta>


  */

  window.GDepthEncoder = {

    xmlns: {
      'GFocus': 'http://ns.google.com/photos/1.0/focus/',
      'GImage': 'http://ns.google.com/photos/1.0/image/',
      'GDepth': 'http://ns.google.com/photos/1.0/depthmap/',
      'xmpNote': 'http://ns.adobe.com/xmp/note/',
    },

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
      xmp.push('/></rdf:RDF></x:xmpmeta>');
      return xmp.join('');
//       xmpNote:HasExtendedXMP="420161059863C43993D79FBDFA80C997"
    },

    dataURIsplit: function(uri) {
      return uri.match(/^data:(.+?);(.+?),(.+)$/);
    },

    /**
    @param ArrayBuffer buffer image JPG as an ArrayBuffer
    @param dataURI depthmap
    @param dataURI original
    */
    encodeDepthmap: function(buffer, depthmap, original, metadata) {
      var props = {}, extProps = {}, standardXMP, extendedXMP;
      depthmap = this.dataURIsplit(depthmap || '');
      original = this.dataURIsplit(original || '');
      if (depthmap) {
        props['GDepth:Format'] = 'RangeInverse';
        props['GDepth:Mime'] = depthmap[1];
        extProps['GDepth:Data'] = depthmap[3];
      }
      if (original) {
        props['GImage:Mime'] = original[1];
        extProps['GImage:Data'] = depthmap[3];
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
            parts.push([0xFF]);
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
          if (app1Header === 'http://ns.adobe.com/xap/1.0/') {
            console.log('Found old XMP, skipping');
            offset += segSize - (offset - segStart - 2);
            continue;
          }
        }
        // copying segment
        console.log('Copying segment ' + segType + ', size: ' + segSize + ', left:' + (segSize - (offset - segStart - 2)));
        offset += segSize - (offset - segStart - 2);
        parts.push(new Uint8Array(buffer, segStart, 1 + segSize));
        if (segType === 0xE1) {
          writeXMP(); // right after EXIF
        }
      }
      return new Blob(parts, {type: 'image/jpeg'});
    },

    buildXMPsegments: function(standardXMP, extendedXMP) {
      // console.log('StandardXMP: ', standardXMP);
      // console.log('ExtendedXMP: ', extendedXMP);
    },

  };

})();