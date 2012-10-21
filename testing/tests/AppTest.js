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

var capsela = require('../../');
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

    "test non-running services not stopped": function(test) {

        var service = new capsela.Service('database');

        service.start = function() {
//            this.running = true;
            return Q.delay('ok', 10);
        };

        // should not be called
        service.stop = function() {
            test.ok(false);
        };

        var app = new App();

        app.addService('database', service);

        return app.start().then(
            function() {
                return app.stop();
            }
        );
    },

    "test add service object": function(test) {

        test.expect(12);

        var started = false;
        var stopped = false;

        var service = new capsela.Service('database');

        service.start = function() {
            started = true;
            this.running = true;
            this.log(Log.ALERT, 'uh-oh');
            return Q.delay('ok', 10);
        };

        service.stop = function() {
            stopped = true;
            this.log(Log.WARNING, 'doggone');
            return Q.delay('ok', 10);
        };

        var app = new App('development');

        app.addService('database', service);

        var expected = [
            {p: Log.INFO, m: 'app starting in development mode'},
            {p: Log.INFO, m: 'starting database'},
            {p: Log.ALERT, m: 'uh-oh'},
            {p: Log.INFO, m: 'stopping database'},
            {p: Log.WARNING, m: 'doggone'}
        ];

        app.on('log', function(priority, message) {
            var exp = expected.shift();
            test.equal(priority, exp.p);
            test.equal(message, exp.m);
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
    },

    "test addService/start/stop": function(test) {

        test.expect(9);

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

        var expected = [
            {p: Log.INFO, m: 'app starting in development mode'},
            {p: Log.INFO, m: 'starting database'},
            {p: Log.INFO, m: 'stopping database'}
        ];

        app.on('log', function(priority, message) {
            var exp = expected.shift();
            test.equal(priority, exp.p);
            test.equal(message, exp.m);
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
    },

    "test start w/error": function(test) {

        test.expect(5);

        var started = false;
        var stopped = false;

        var app = new App();

        app.addService('dummy', function() {
            throw new Error("oh no!");
        },
            function() {
                // should not run
                test.ok(false);
            });

        var expected = [
            {p: Log.INFO, m: 'app starting in testing mode'},
            {p: Log.INFO, m: 'starting dummy'}
        ];

        app.on('log', function(priority, message) {
            var exp = expected.shift();
            test.equal(priority, exp.p);
            test.equal(message, exp.m);
        });

        app.start().then(null,
            function(err) {
                test.equal(err.message, "oh no!");
                test.done();
            }
        );
    },

    "test addService w/out start/stop": function(test) {

        test.expect(4);

        var started = false;
        var stopped = false;

        var app = new App('development');

        test.equal(app.mode, 'development');

        app.addService('dummy');

        app.on('log', function(priority, message) {
            test.equal(priority, Log.INFO);
        });

        return app.start().then(
            function() {
                return app.stop();
            }
        );
    }
}