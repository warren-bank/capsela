[![build status](https://secure.travis-ci.org/capsela/capsela.png)](http://travis-ci.org/capsela/capsela)
# Capsela

A high-level, promises-based web framework for Node.js with an emphasis on testability.
*Capsela is 100% ES5 strict mode compliant.*

### To install:

    npm install capsela

### To run the tests:

    testpilot testing/tests

## Introduction

Capsela servers are [chains](http://en.wikipedia.org/wiki/Chain_of_responsibility_pattern) of request-processing stages. A request flows down through the stages of a server, and a response is passed back up. Each stage can choose to generate a response or pass the request on to the next stage. Each stage can also modify or replace a request as it flows down or a response as it flows up. Stages (aka middleware) can thus act as both handlers and filters.

## Example: the simplest app

```js
var capsela = require('capsela');

new capsela.Server()
    .addStage(
        function(request) {
            return new capsela.Response(200, {}, "Hello, World!");
        })
    .start();
```

Server, Request and Response are Capsela classes that wrap the corresponding Node constructs to provide higher-level APIs and facilitate testing. For instance, to get the value of a cookie sent with the request, you can just call request.getCookie(name). Likewise, to force a browser to download a file it would otherwise display (such as a JPEG image), you can just call response.forceDownload() and not have to worry about the particulars.

Note that rather than taking a request/response pair, Capsela stages take a request and return a response. As fans of functional programming languages will tell you, this style of programming has huge benefits in the form of greater power, simplicity and testability. But since Node is asynchronous, this is only possible with the use of [promises](http://en.wikipedia.org/wiki/Futures_and_promises).

## Example: serving a file

```js
var capsela = require('capsela');

new capsela.Server()
    .addStage(
        function(request) {
            return capsela.FileResponse.create(__dirname + "/public/hello_world.png");
        })
    .start();
```

A big advantage of returning a response rather than working with one we've been given is that we can return whatever we want. We can return specialized Response subclasses, raw precursors such as Views or Blobs that can be rendered into proper Response objects by downstream stages, or a promise, as shown above. FileResponse.create() returns a promise because it stats the file to get its mtime and make sure it's readable.

Promises make Node programming far less painful and error-prone, but there are a couple caveats. The first is that there's a learning curve; Capsela is built on the [Q](http://github.com/kriskowal/q) promises library and you'll be more productive if you know how it works. The second is that promises and callbacks don't play well together: writing mixed code is often more painful than using either style exclusively. For this reason, Capsela is 100% promise-style code.

## Example: a more useful app

    var capsela = require('capsela');

    new capsela.Server()
        .addStage(new capsela.stages.PreferredHost('www.capsela.org'))
        .addStage(new capsela.stages.ViewRenderer(__dirname + '/views', capsela.views.JsonTemplate))
        .addStage(new capsela.stages.ErrorHandler(errorTemplate))
        .addStage(new capsela.stages.FileServer('/', __dirname + '/public'))
        .addStage(new capsela.stages.SessionManager())
        .addStage(new capsela.stages.Dispatcher(__dirname + '/controllers'))
        .start();

As you'd expect, Capsela comes out of the box with several stages that provide solutions to common problems such as error handling, serving static files, managing sessions, and dispatching to MVC-style controllers.

A core requirement of Capsela is testability: unit and functional tests need to be easy to write and have the greatest possible veracity. This has driven both the architecture of the framework itself as well as a major investment in developing test infrastructure, including accurate mocks of Node objects such as ServerRequest and ServerResponse, and powerful testing tools such as the Browser class.

## Example: an end-to-end app test

    var browser = new Browser();

    browser.get(appBaseUrl + '/login').then(
        function() {
            browser.fill('email', 'test@example.com');
            browser.fill('password', 'password1');

            return browser.pressButton('Sign in');
        }
    ).then(
        function(response) {

            var $ = browser.window.$;

            test.equal(response.statusCode, 200);
            test.ok($('.error').text().indexOf("Sorry, that password is incorrect.") >= 0);
        }
    ).end();

You might have noticed that we're using jQuery in the assertions, which is a beautiful way of analyzing HTML responses; the browser window contains a full DOM implementation (courtesy of JSDOM). As you can see, the promise-based Browser class provides a powerful and natural testing style that lets you develop high-quality code with minimal effort. It can also be used for making assertions against JSON and binary responses, for loading and making assertions against HTML emails, or as a powerful page-scraper in your application proper.

## MIT License

Copyright (c) 2011-2012 by the Capsela contributors

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.