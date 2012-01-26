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
 * Date: 1/26/12
 */

"use strict";

var Class = require('capsela-util').Class;
var Log = require('capsela-util').Log;
var Logger = require('capsela-util').Logger;
var Q = require('q');

var Service = Class.extend(
/** @lends Service */ {
    mixin: Logger
},
/** @lends Service# */ {
    ////////////////////////////////////////////////////////////////////////////
    /**
     * Creates a new service from the given name and functions.
     *
     * @constructs
     * @param name
     * @param start
     * @param shutdown
     */
    init: function(name, start, shutdown) {

        this.name = name;
        this.doStart = start || function() {};
        this.shutdown = shutdown || function() {};
        this.running = false;
    },

    ////////////////////////////////////////////////////////////////////////////
    /**
     * Starts the service, returning a promise that's resolved when the service
     * has started or rejected on error.
     *
     * @return {promise}
     */
    start: function() {

        var self = this;

        return Q.when(this.doStart(),
            function() {
                self.running = true;
            });
    },

    ////////////////////////////////////////////////////////////////////////////
    /**
     * Stops the service, returning a promise that's resolved when the service
     * has stopped or rejected on error.
     */
    stop: function() {

        var self = this;

        return Q.when(this.shutdown(),
            function() {
                self.running = false;
            });
    },

    ////////////////////////////////////////////////////////////////////////////
    /**
     * Returns true if this service is running (started successfully).
     *
     * @return boolean
     */
    isRunning: function() {
        return this.running;
    }
});

exports.Service = Service;