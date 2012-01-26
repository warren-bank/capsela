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

var Class = require('capsela-util').Class;
var Log = require('capsela-util').Log;
var Logger = require('capsela-util').Logger;
var capsela = require('capsela');
var Q = require('q');

var App = Class.extend(
/** @lends App */ {

    mixin: Logger
},
/** @lends App# */ {
    ////////////////////////////////////////////////////////////////////////////
    /**
     * @constructs
     * @param {string} mode  the mode to run in (testing/development/production)
     */
    init: function(mode) {

        this.mode = mode || 'testing';

        if (this.mode != 'testing' && this.mode != 'development' && this.mode != 'production') {
            throw new Error("mode must be one of testing, development or production");
        }

        this.services = [];
        this.LOG = new Log();
        this.LOG.watch(this);
        
        var t = this;

        // install minimal logging exception handler to prevent process exit on error
        process.on('uncaughtException', function (err) {
            t.log(Log.ERROR, 'UNCAUGHT EXCEPTION: ' + err + '\n' + err.stack);
        });
    },

    ////////////////////////////////////////////////////////////////////////////
    /**
     * Adds the given service to the app.
     * 
     * @param name
     * @param start
     * @param stop
     */
    addService: function(name, start, stop) {

        var service;

        if (start == null || typeof start == 'function') {
            service = new capsela.Service(name, start, stop);
        }
        else {
            service = start;
            this.echo(service);
        }

        // todo disable this method after we call start

        this.services.push(service);
    },

    ////////////////////////////////////////////////////////////////////////////
    /**
     * Starts each service and waits for it to complete its setup before
     * starting the next service. Returns a promise that's resolved when
     * the app has started.
     *
     * @return {promise} completion promise
     */
    start: function() {

        var t = this;

        t.log(Log.INFO, 'app starting in ' + t.mode + ' mode');

        function launchService(index) {

            index = index || 0;

            var service = t.services[index];

            if (!service) {
                return;
            }

            t.log(Log.INFO, "starting " + service.name);

            return Q.call(service.start, service).then(
                function(result) {
                    return launchService(index + 1);
                });
        }

        this.startup = launchService();

        return t.startup;
    },

    ////////////////////////////////////////////////////////////////////////////
    /**
     *
     */
    stop: function() {

        var t = this;
        var started = [];

        // find all running services
        t.services.forEach(function(service) {
            if (service.isRunning()) {
                started.push(service);
            }
        });

        if (started.length == 0) {
            t.log(Log.WARNING, 'no services running');
        }

        function stopService() {

            var service = started.pop(); // LIFO

            if (!service) {
                return;
            }

            t.log(Log.INFO, "stopping " + service.name);

            return Q.call(service.stop, service).then(
                function() {
                    return stopService();
                },
                function(err) {
                    // report!
                    t.log(Log.ERROR, "error stopping " + service.name + ": " + err.stack);

                    // keep on truckin'
                    return stopService();
                });

            // keep on truckin'
            return stopService();
        }

        return this.startup.then(
            function() {
                return stopService();
            }
        )
    }
});

exports.App = App;