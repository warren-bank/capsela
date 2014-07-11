/*!
 * Copyright (C) 2011 by the Capsela contributors
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
 * Date: 11/1/11
 */

"use strict";

var fs = require('fs');
var path = require('path');
var parseUrl = require('url').parse;
var resolveUrl = require('url').resolve;
var formatUrl = require('url').format;
var Q = require('q');

var Class = require('capsela-util').Class;
var Pipe = require('capsela-util').Pipe;

var HttpClient = require(__dirname + '/HttpClient').HttpClient;
var Request = require(__dirname + '/Request').Request;
var Cookie = require(__dirname + '/Cookie').Cookie;
var create_form_from_request = require(__dirname + '/Form').Form.createFromRequest;
var Log = require('capsela-util').Log;
var Logger = require('capsela-util').Logger;

var jsdom = require('jsdom');
var jquery = fs.readFileSync(__dirname + "/../deps/jquery-1.7.1.min.js", 'utf8');

parseUrl = (function(_default){
	var _new = function(){
		var parts = _default.apply(this, arguments);

		if (typeof parts.protocol === 'string'){
			parts.protocol = parts.protocol.replace(/:\/*$/,'');
		}

		if (typeof parts.search === 'string'){
			parts.search = parts.search.replace(/^[\?&]/,'').replace(/[\?&]$/,'');
		}

		return parts;
	};
	return _new;
})(parseUrl);

var Browser = Class.extend(
/** @lends Browser */ {

    mixin: Logger,

    REDIRECT_LIMIT: 10
},
/** @lends Browser# */ {
    ///////////////////////////////////////////////////////////////////////////////
    /**
     * @constructs
     * @param timeout   the request timeout, in seconds
     */
    init: function(timeout, jsdom_features) {
        this.cookiesByHost = {};
        this.followRedirects = true;
        this.jQueryify = true;
        this.timeout = timeout || 3000; // default timeout of 3s
        this.LOG = new Log();
        this.LOG.watch(this);
		this.jsdom_features = jsdom_features || false;
    },

    ///////////////////////////////////////////////////////////////////////////////
    /**
     *
     */
    enableRedirects: function() {
        this.followRedirects = true;
    },

    ///////////////////////////////////////////////////////////////////////////////
    /**
     *
     */
    disableRedirects: function() {
        this.followRedirects = false;
    },

    ///////////////////////////////////////////////////////////////////////////////
    /**
     * Loads the given HTML document into the browser window.
     *
     * @param html
     * @param mediaType
     *
     * @return promise  completion promise
     */
    loadDocument: function(html, mediaType) {

        var t = this;
        var d = Q.defer();

		try {
			jsdom.env({
				"html"		: html,
				"src"		: t.jQueryify && [jquery],
				"features"	: t.jsdom_features,
				"done"		: function(err, window) {
					if (err) {
						d.reject(err);
					}
					else {
						t.window = window;
						t.window.data = html;
						d.resolve(window);
					}
				}
			});
		}
		catch(err){
			t.LOG.log(Log.DEBUG, err);
			d.reject(err);
		}

        return d.promise;
    },

    ///////////////////////////////////////////////////////////////////////////////
    /**
     *
     */
	resolveUrl : function(to){
		var t = this;
		var url = (t.window && t.window.location && t.window.location.href)? resolveUrl(t.window.location.href, to) : to;
		return url;
	},

    ///////////////////////////////////////////////////////////////////////////////
    /**
     * Returns a promise for a JSDOM window with JQuery installed.
     *
     * @param url
     * @param redirect  an optional redirecting response object
     *
     * @return promise
     */
    get: function(url, redirect) {

        if (redirect) {
            this.redirects.push(redirect);
            if (this.redirects.length >= this.Class.REDIRECT_LIMIT) {
                return Q.reject(new Error("redirect limit reached"));
            }
        }
        else {
            this.redirects = [];
        }

        // create the request
        var t = this;
        var parts;

		if (typeof url === 'string'){
			parts = parseUrl(url);
		}
		else if ((typeof url === 'object') && (url !== null)){
			parts = url;
		}
		else {
			throw new Error('url is not valid: ' + JSON.stringify(url));
		}

        var request = new Request(
				'GET'
			,	parts.pathname + (parts.search ? ('?' + parts.search) : '')
			,	{'host': parts.hostname}
			,	false
			,	parts.protocol
		);

/* ********************************************************
 * notes:
 *   - request.bodyStream is set to a new Pipe() by the Request constructor.
 *   - request.bodyStream is set to the return value from (http||https).request() within this.dispatch() -> this.clientDispatch -> HttpClient.dispatch()
 *       => consequently, the socket should be used [ie: write(), end()] after this.dispatch() has been called.
 *   - this.window is assigned a jsdom window object within this.dispatch() -> this.loadDocument()
 * ******************************************************** */

        var result = this.dispatch(parts.hostname, request)
            .then(function(response) {

                // set the location info
/* ********************************************************
 * avoid throwing the Exception:
 *     TypeError: Cannot set property pathname of object which has only a getter
 * ******************************************************** */
//				t.window.location.href = url;
//				t.window.location.pathname = parts.pathname;
				if (
						((redirect) && (redirect === t.redirects.length))
					||	((! redirect) && (! t.redirected()))
				){
					t.window.location.href = formatUrl(parts);
				}
                return response;
            });

        request.bodyStream.end();

        return result;
    },

    ///////////////////////////////////////////////////////////////////////////////
    /**
     * Posts the given body data to the given URL.
     *
     * @param url
     * @param body          the data to send as the body
     * @param contentType   the value of the content-type header
     */
    post: function(url, body, contentType, contentLength) {
		this.redirects = [];

        // create the request
        var t = this;
        var parts;

		if (typeof url === 'string'){
			parts = parseUrl(url);
		}
		else if ((typeof url === 'object') && (url !== null)){
			parts = url;
		}
		else {
			throw new Error('url is not valid: ' + JSON.stringify(url));
		}

		if (! body){
			body = (parts.search)? parts.search : '';
		}
		if (! contentType){
			contentType = 'application/x-www-form-urlencoded';
		}

		var request_options	= {
			"encoding"		: "utf8",
			"headers"		: {'host': parts.hostname, 'content-type': contentType}
		};

		if (contentLength === false){
			request_options.headers['transfer-encoding'] = 'chunked';
		}
		else {
			// default behavior
			if (typeof contentLength !== 'number'){
				contentLength = Buffer.byteLength(body, request_options.encoding);
			}
			request_options.headers['content-length'] = contentLength;
		}

        var request			= new Request(
				'POST'
			,	parts.pathname
			,	request_options.headers
			,	false
			,	parts.protocol
		);

/* ********************************************************
 * notes:
 *   - request.bodyStream is set to a new Pipe() by the Request constructor.
 *   - request.bodyStream is set to the return value from (http||https).request() within this.dispatch() -> this.clientDispatch -> HttpClient.dispatch()
 *       => consequently, the socket should be used [ie: write(), end()] after this.dispatch() has been called.
 *   - this.window is assigned a jsdom window object within this.dispatch() -> this.loadDocument()
 * ******************************************************** */

        var result = this.dispatch(parts.hostname, request)
            .then(function(response) {

                // set the location info
/* ********************************************************
 * avoid throwing the Exception:
 *     TypeError: Cannot set property pathname of object which has only a getter
 * ******************************************************** */
//				t.window.location.href = url;
//				t.window.location.pathname = parts.pathname;
				t.window.location.href = formatUrl(parts);

                return response;
            });

        t.LOG.log(Log.DEBUG, 'browser sending POST data: ' + body);

        request.bodyStream.write(body, request_options.encoding);
		request.bodyStream.end();

        return result;
    },

    ///////////////////////////////////////////////////////////////////////////////
    /**
     * Posts the given form.
     *
     * @param url
     * @param form - require(__dirname + '/Form').Form
     */
    postForm: function(url, form) {
		this.redirects = [];

        // create the request
        var t = this;
        var parts;

		if (typeof url === 'string'){
			parts = parseUrl(url);
		}
		else if ((typeof url === 'object') && (url !== null)){
			parts = url;
		}
		else {
			throw new Error('url is not valid: ' + JSON.stringify(url));
		}

        var boundary = 'simple boundary';
        var request = new Request(
				'POST'
			,	parts.pathname
			,	{'host': parts.hostname, 'content-type': ('multipart/form-data; boundary="' + boundary + '"'), 'transfer-encoding': 'chunked'}
			,	false
			,	parts.protocol
		);

        var result = this.dispatch(parts.hostname, request)
            .then(function(response) {

                // set the location info
/* ********************************************************
 * avoid throwing the Exception:
 *     TypeError: Cannot set property pathname of object which has only a getter
 * ******************************************************** */
//				t.window.location.href = url;
//				t.window.location.pathname = parts.pathname;
				t.window.location.href = formatUrl(parts);

                return response;
            });

		var _form = (function(form, request){
			var result = Q.defer();

			if (form){
				result.resolve(form);
			}
			else {
				create_form_from_request(request)
				.then(
					function(form){
						result.resolve(form);
					}
				);
			}

			return result.promise;
		})(form, request);

		_form.then(
			function(form){
				form.serialize(request.bodyStream, boundary);
				request.bodyStream.end();
			}
		);

        return result;
    },

    ///////////////////////////////////////////////////////////////////////////////
    /**
     * Submits the given jQuery form.
     *
     * @param $form - jQuery wrapped form DOM element
     * @param send_content_length - when (POST and !is_multiPart): boolean FALSE => prevents 'content-length' header, integer => explicit value for 'content-length' header, otherwise => value for 'content-length' header is calculated from the body content and included in the request
     */
    submit_$form: function($form, send_content_length) {
        var t				= this;
		var method			= ($form.attr('method') || 'GET').toUpperCase();
		var is_GET			= (method === 'GET');
		var is_multiPart	= (($form.attr('enctype') || '').toLowerCase() === 'multipart/form-data');
		var action			= t.resolveUrl($form.attr('action'));
		var parts			= parseUrl(action);

		parts.search		= ((parts.search)? (parts.search + '&') : '') + $form.serialize();

		if (is_GET){
			return t.get(parts);
		}
		else {
			// POST
			if (! is_multiPart){
				return t.post(parts, false, false, send_content_length);
			}
			else {
				return t.postForm(parts);
			}
		}
	},

    ///////////////////////////////////////////////////////////////////////////////
    /**
     * Returns true if the last page fetch was due to a redirect.
     *
     * @return boolean
     */
    redirected: function() {
        return this.redirects.length > 0;
    },

    ///////////////////////////////////////////////////////////////////////////////
    /**
     * Clicks the link identified by the given selector.
     *
     * @param selector
     *
     * @return promise
     */
    followLink: function(selector) {

        var link = this.getElement(selector);

        if (link.length !== 1) {
            throw new Error("couldn't find the specified link to click on");
        }

        return this.get(link.attr('href'));
    },

    ///////////////////////////////////////////////////////////////////////////////
    /**
     * Returns a promise for a response to the given request.
     *
     * @param hostname
     * @param request
     *
     * @return promise
     */
    dispatch: function(hostname, request) {

        var t = this;

//      request.headers['user-agent'] = 'Capsela Browser';
		request.headers['user-agent'] = 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:30.0) Gecko/20100101 Firefox/30.0';

        // add any cookies
        // todo replace with a proper cookie jar
        if (t.cookiesByHost[hostname]) {

            var cookies = t.cookiesByHost[hostname];
            var pairs = [];

            cookies.forEach(function(cookie) {
                pairs.push(cookie.name + '=' + cookie.value);
            });

            request.headers['cookie'] = pairs.join(';');
        }

        // don't emit - just log directly - to avoid confusing tests that watch the log
        t.LOG.log(
			Log.DEBUG,
			(
				'browser requesting ' + request.method.toUpperCase() + ' ' +
				(request.isSecure() ? 'https://' : 'http://') + hostname + request.url
			)
		);

        return this.clientDispatch(hostname, request).then(
            function(response) {
                var cookies = response.getHeader('set-cookie');
                var mediaType = response.getHeader('content-type');

                // save any cookies
                // todo replace with a proper cookie jar
                if (cookies) {
                    cookies.forEach(function(setCookie) {
                        var cookie = Cookie.fromString(setCookie);

                        if (t.cookiesByHost[hostname] == undefined) {
                            t.cookiesByHost[hostname] = [cookie];
                        }
                        else {
                            t.cookiesByHost[hostname].push(cookie);
                        }
                    });
                }

                // follow redirects
                if (t.followRedirects &&
                    [301, 302, 303].indexOf(response.statusCode) >= 0) {

                    return t.get(
						t.resolveUrl(response.getHeader('location')),
						(t.redirects.length + 1)
					);
                }
                else {

                    // todo only buffer if the result is text/html or JSON?
                    var result = Pipe.buffer(response.getBodyStream())
                    .then(
                        function(data) {

                            // put the data on the response
                            response.data = data;

                            // update the window if we got an HTML page back
                            if (data && mediaType && mediaType.indexOf('text/html') >= 0) {

                                // create a DOM window from the response
                                return t.loadDocument(data.toString(), mediaType).then(
                                    function() {
                                        return response;
                                    },
                                    function(err) {

                                        t.log(Log.WARNING,
                                            "text/html response not a valid HTML document");

                                        t.window = {
                                            location: {},
                                            data: data.toString()
                                        };

                                        return response;
                                    }
                                );
                            }
                            else {
                                t.window = {
                                    location: {},
                                    data: data
                                };

                                return response;
                            }
                        },
                        function(err) {

                            if (err.message == 'no data received') {
                                t.window = {
                                    location: {}
                                };
                                return response;
                            }
                            else {
                                return err;
                            }
                        }
                    );

                    response.getBodyStream().resume();

                    return result;
                }
        });
    },

    ///////////////////////////////////////////////////////////////////////////////
    /**
     * Dispatches the given request to the HTTP client.
     *
     * @param hostname
     * @param request
     *
     * @return promise  for a clientresponse
     */
    clientDispatch: function(hostname, request) {
        return new HttpClient(
				hostname
			,	(request.isSecure()? 443 : 80)
			,	(request.isSecure())
		).dispatch(request, this.timeout);
    },

    ///////////////////////////////////////////////////////////////////////////////
    /**
     * Fills in the specified input field with the given value.
     *
     * @param selector  name or CSS selector
     * @param value
     */
    fill: function(selector, value) {

        // get the form
        var input = this.getElement(selector);

        input.val(value);
    },

    ///////////////////////////////////////////////////////////////////////////////
    /**
     * Checks the specified checkbox.
     *
     * @param selector
     */
    check: function(selector) {

        var input = this.getElement(selector);

        if (input.attr('type') == 'checkbox') {
            input.attr('checked', 'checked');
        }
        else {
            throw new Error(selector + " is not a checkbox");
        }
    },

    ///////////////////////////////////////////////////////////////////////////////
    /**
     * Unchecks the specified checkbox.
     *
     * @param selector
     */
    uncheck: function(selector) {

        var input = this.getElement(selector);

        if (input.attr('type') == 'checkbox') {
            input.removeAttr('checked');
        }
        else {
            throw new Error(selector + " is not a checkbox");
        }
    },

    ///////////////////////////////////////////////////////////////////////////////
    /**
     * Clicks the specified button.
     *
     * @param selector
     */
    pressButton: function(selector) {
		var $button, form, $form;
		var t = this;

		$button = t.getElement(selector);
		if ($button.length === 0) {
			throw new Error('pressButton selector not found: ' + selector);
		}
		else if ($button.length > 1){
			throw new Error('pressButton selector does not uniquely identify one DOM element: ' + selector);
		}

		// 1st, attempt to directly obtain from the DOM element the identify of its container <form>
		form = $button.get(0).form;
		if (form){
			///////////////////////////////////////////////////////////////////////////////
			/**
			 * based on:
			 *     https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement
			 * "form" can either be an HTMLFormElement (HTML4) or a string "id" attribute belonging to a <form> element (HTML5)
			 */
			if (typeof form === 'string'){
				form = 'form#' + form;
			}
			$form = t.window.$( form );
		}

		// 2nd, fallback attempt to traverse the DOM looking for a container <form>
		if ((! $form) || ($form.length === 0)){
			$form = $button.closest('form');
			if ($form.length === 0) {
				throw new Error('pressButton selector is valid, but does not occur within a parent <form> DOM element: ' + selector);
			}
		}

		return t.submit_$form($form);
    },

    ///////////////////////////////////////////////////////////////////////////////
    /**
     * Returns the form element having the given name or matching the specified CSS
     * selector, or null if not found.
     *
     * @param name  an element name or CSS selector
     */
    getElement: function(name) {
		if (name instanceof this.window.$){
			return name;
		}

        // try matching the name
        var el = this.window.$('[name="' + name + '"]');

        if (el.length > 0) {
            return el;
        }

        // try matching button inner text
        el = this.window.$('button:contains(' + name + ')');

        if (el.length > 0) {
            return el;
        }

        // try matching link inner text
        el = this.window.$('a:contains(' + name + ')');

        if (el.length > 0) {
            return el;
        }

        // try matching value
        el = this.window.$('[value="' + name + '"]');

        if (el.length > 0) {
            return el;
        }

        return this.window.$(name);
    },

    ///////////////////////////////////////////////////////////////////////////////
    /**
     * Reloads the page.
     *
     * @return promise
     */
    reload: function() {
        return this.get(this.window.location.href);
    }
});

exports.Browser = Browser;
