DEPTHY
======

Images with depthmap playground.

Depthy shows Google Camera Lens Blur photos with 3D parallax effect and creates animated GIFs from them. Plus extracts the depth map and enables you to create your own!

This is the source of the http://depthy.me/ webapp. Contributions more than welcome!

## How to build

- Install node + npm
- Run anywhere: `npm install -g grunt-cli bower`
- Run in project directory: `npm install` and `bower install`
- For local development server run: `grunt serve`
- For deployment: `grunt build`

## Docker image
If you want to simply run depthy locally, you can use [Docker.io](https://www.docker.com/).

Once docker installed, simple run:
```
$ docker run --rm -t -i -p 9000:9000 essembeh/depthy
```

Then go to [localhost:9000](http://localhost:9000)

## Authors

**[Rafał Lindemann](http://www.stamina.pl/)** (idea, code, ux) with much appreciated help of
**[Łukasz Marcinkowski](http://th7.org/)** (idea, code)

## How to help

There is a lot of stuff you can do with depthmaps. If you have ideas and you know how to code,
You already know how to help ;) I'm pretty lax on formalities, just make it work and at least 
try to follow conventions of the code...

## License

The MIT License

Copyright (c) 2014 Rafał Lindemann. http://panrafal.github.com/depthy

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

