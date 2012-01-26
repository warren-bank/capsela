/*!
 * Copyright (C) 2011 Sitelier Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 * Author: Seth Purcell
 * Date: 1/19/12
 */

"use strict";

var capsela = require('capsela');
var App = capsela.App;
var mp = require('capsela-util').MonkeyPatcher;
var Log = require('capsela-util').Log;
var Q = require('q');

exports.basics = {

    setUp: mp.setUp,
    tearDown: mp.tearDown,
    
    "test init": function(test) {

        test.expect(4);

        var gecb;
        
        mp.patch(process, 'on', function(event, cb) {
            test.equal(event, 'uncaughtException');
            gecb = cb;
        });

        var app = new App();
        var err = new Error("Oh God, no!");

        test.equal(app.mode, 'testing');

        // patch the logger
        app.log = function(priority, message) {
            test.equal(priority, Log.ERROR);
            test.equal(message, 'UNCAUGHT EXCEPTION: ' + err + '\n' + err.stack);
        };

        // pretend a global exception was thrown
        gecb(err);

        test.done();
    },

    "test addService/start/stop": function(test) {

        test.expect(4);

        var started = false;
        var stopped = false;
        
        var app = new App('development');

        test.equal(app.mode, 'development');

        app.addService('database',
            function() {
                started = true;

                return Q.delay('ok', 10);
            },
            function() {

                stopped = true;

                return Q.delay('ok', 10);
            });

        app.on('log', function(priority, message) {
            test.equal(priority, Log.INFO);
        });

        app.start().then(
            function() {
                
                test.ok(started);
                return app.stop();
            }
        ).then(
            function() {
                
                test.ok(stopped);
                test.done();
            }
        ).end();
    }
}