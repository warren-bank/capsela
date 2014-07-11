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
 * Date: 4/6/11
 */

"use strict";

var testbench = require(__dirname + '/../TestBench');

var capsela = require(__dirname + "/../../");
var Browser = capsela.Browser;
var Request = capsela.Request;
var Response = capsela.Response;

var HttpClientRig = capsela.rigs.HttpClientRig;
var Stage = capsela.Stage;

var $test = undefined;

module.exports["basics"] = {

    setUp: function(cb) {
        HttpClientRig.setUp();

        HttpClientRig.addStage('http', 'www.example.com', 80, new Stage(
            function(request) {
            }
        ));

        cb();
    },

    tearDown: function(cb) {
        HttpClientRig.tearDown();
        cb();
    },

    "test dispatch": function(test) {

        var b = new Browser();
        var request = new Request();

        b.dispatch('www.example.com', request).then(
            function(response) {
                test.done();
            }
        ).done();

        request.bodyStream.end();
    }
};

module.exports["testing the new form handlers in the wild"] = {

    "setUp": function(cb) {
		$test = {
			"class": function(test, b, site){
				var self = this;

				this.test = test;
				this.b = b;
				this.site = site;

				this.fail = function(err){
					self.test.fail(err);
				};

				this.done = function(){
					try {self.b.window.close();}
					catch(e){}
					self.test.done();
				};

				this.assert_initial_context = function(options){
					var $input, $button;

					switch(self.site){
						case 'google':
							$input  = self.b.window.$('input#gbqfq');
							$button = self.b.window.$('button#gbqfba');
							break;
						case 'wikipedia':
							$input  = self.b.window.$('form#searchform input#searchInput');
							$button = self.b.window.$('form#searchform input#searchButton');
							break;
						case 'yahoo':
							$input  = self.b.window.$('form#sf input#yschsp');
							$button = self.b.window.$('form#sf input[type="submit"]');
							break;
						case 'bing':
							$input  = self.b.window.$('form#sb_form input#sb_form_q');
							$button = self.b.window.$('form#sb_form input#sb_form_go');
							break;
						default:
							$input  = self.b.window.$();
							$button = self.b.window.$();
							break;
					}

					self.test.equal(
						$input.length,
						1
					);
					if (options && options.set_value){
						$input.val('hello world');
					}
					self.test.equal(
						$input.val(),
						'hello world'
					);
					self.test.equal(
						$button.length,
						1
					);
					return [$input, $button];
				};

				this.display_results_page = function(response){
					if ((typeof response === 'object') && (typeof response.data === 'object')){
						console.log( 'response length = ' + response.data.length + ' bytes' );
						console.log( 'response content:' );
						console.log( response.data.toString() );
					}
					else {
						console.log( 'typeof response = ' + (typeof response) );
						console.log( 'typeof response.data = ' + (typeof response.data) );
					}
				};

				this.assert_results_page = function(response){
					var $stats, pattern;

				//	self.display_results_page(response);

					self.test.equal(
						(typeof self.b.window.document),
						'object'
					);

					switch(self.site){
						case 'google':
							$stats  = self.b.window.$('div#resultStats');
							pattern = /^\s*about\s+[\d,]+\s+results/i;
							break;
						case 'wikipedia':
							$stats  = self.b.window.$('#mw-content-text .results-info');
							pattern = /^\s*results\s+[\d,]+\s*[\u2013-]\s*[\d,]+\s+of\s+[\d,]+/i;
							break;
						case 'yahoo':
							$stats  = self.b.window.$('#cols #left #pg > span:last-child');
							pattern = /^\s*[\d,]+\s+results/i;
							break;
						case 'bing':
							$stats  = self.b.window.$('#b_content #b_tween span.sb_count');
							pattern = /^\s*[\d,]+\s+results/i;
							break;
						default:
							$stats  = self.b.window.$();
							pattern = /./;
							break;
					}

					self.test.equal(
						$stats.length,
						1
					);
					self.test.equal(
						pattern.test( $stats.text() ),
						true
					);
				};
			},
			"obj": null
		};
		cb();
	},
    "tearDown": function(cb) {
		$test = undefined;
		cb();
	},

	"GET http request [google.com, avoiding DNS lookup] (jsdom.env <- loadDocument <- clientDispatch <- dispatch <- get)": function(test){
		var timeout	= 15000;
		var b		= new Browser(timeout);
		var url		= 'http://216.239.32.20/?q=hello+world';

		$test.obj	= new $test.class(test, b, 'google');

		b
			.get(url)
			.then(
				function(response){
					test.equal(
						b.redirected(),
						false
					);
					return $test.obj.assert_initial_context();
				}
			)
			.fail( $test.obj.fail )
			.done( $test.obj.done )
		;
	},

	"GET http request with GET https redirect [google.com] (jsdom.env <- loadDocument <- clientDispatch <- dispatch <- get <- (302 Found) <- clientDispatch <- dispatch <- get)": function(test){
		var timeout	= 15000;
		var b		= new Browser(timeout);
		var url		= 'http://www.google.com/?q=hello+world';

		$test.obj	= new $test.class(test, b, 'google');

		b
			.get(url)
			.then(
				function(response){
					test.equal(
						b.redirected(),
						true
					);
					test.equal(
						b.window.location.protocol,
						'https:'
					);
					return $test.obj.assert_initial_context();
				}
			)
			.fail( $test.obj.fail )
			.done( $test.obj.done )
		;
	},

	"GET https request [google.com] (jsdom.env <- loadDocument <- clientDispatch <- dispatch <- get)": function(test){
		var timeout	= 15000;
		var b		= new Browser(timeout);
		var url		= 'https://www.google.com/?q=hello+world';

		$test.obj	= new $test.class(test, b, 'google');

		b
			.get(url)
			.then(
				function(response){
					test.equal(
						b.redirected(),
						false
					);
					test.equal(
						b.window.location.protocol,
						'https:'
					);
					return $test.obj.assert_initial_context();
				}
			)
			.fail( $test.obj.fail )
			.done( $test.obj.done )
		;
	},

	"GET https form submission [google.com] (jsdom.env <- loadDocument <- clientDispatch <- dispatch <- post <- submit_$form <- pressButton)": function(test){
		var timeout	= 15000;
		var b		= new Browser(timeout);
		var url		= 'https://www.google.com/?q=hello+world';

		$test.obj	= new $test.class(test, b, 'google');

		b
			.get(url)
			.then(
				function(response){
					test.equal(
						b.redirected(),
						false
					);
					test.equal(
						b.window.location.protocol,
						'https:'
					);
					return $test.obj.assert_initial_context();
				}
			)
			.then(
				function(form_fields){
					var $input, $button;

				//	[$input, $button] = form_fields;	// does nodejs support ECMAScript 6 (JavaScript 1.7) "destructuring assignment"?
					$input	= form_fields[0];
					$button	= form_fields[1];

					$input.val('hello world of tomorrow');
					return b.pressButton($button);
				}
			)
			.then( $test.obj.assert_results_page )
			.fail( $test.obj.fail )
			.done( $test.obj.done )
		;
	},

	"POST https form submission to backend that does not allow POST [google.com] (jsdom.env <- loadDocument <- (405 Method Not Allowed) <- clientDispatch <- dispatch <- post <- submit_$form)": function(test){
		var timeout	= 15000;
		var b		= new Browser(timeout);
		var url		= 'https://www.google.com/?q=hello+world';

		$test.obj	= new $test.class(test, b, 'google');

		b
			.get(url)
			.then(
				function(response){
					test.equal(
						b.redirected(),
						false
					);
					test.equal(
						b.window.location.protocol,
						'https:'
					);
					return $test.obj.assert_initial_context();
				}
			)
			.then(
				function(form_fields){
					var $input, $form;

					$input	= form_fields[0];
					$input.val('hello world of tomorrow');

					$form	= $input.closest('form');
					test.equal(
						$form.length,
						1
					);
					$form.attr('method','POST');

					return b.submit_$form($form);
				}
			)
			.then(
				function(response){
					test.equal(
						response.statusCode,
						405
					);
				}
			)
			.fail( $test.obj.fail )
			.done( $test.obj.done )
		;
	},

	"POST https form submission to backend that requires 'content-length' request header [wikipedia.com] (jsdom.env <- loadDocument <- (411 Length Required) <- clientDispatch <- dispatch <- post <- submit_$form)": function(test){
		var timeout	= 15000;
		var b		= new Browser(timeout);
		var url		= 'https://en.wikipedia.org/wiki/Hello_world';

		$test.obj	= new $test.class(test, b, 'wikipedia');

		b
			.get(url)
			.then(
				function(response){
					test.equal(
						b.redirected(),
						false
					);
					test.equal(
						b.window.location.protocol,
						'https:'
					);
					return $test.obj.assert_initial_context({"set_value":true});
				}
			)
			.then(
				function(form_fields){
					var $input, $form, send_content_length;

					$input	= form_fields[0];
					$input.val('hello world of tomorrow');

					$form	= $input.closest('form');
					test.equal(
						$form.length,
						1
					);
					$form.attr('method','POST');

					send_content_length = false;

					return b.submit_$form($form, send_content_length);
				}
			)
			.then(
				function(response){
					test.equal(
						response.statusCode,
						411
					);
				}
			)
			.fail( $test.obj.fail )
			.done( $test.obj.done )
		;
	},

	"POST https form submission [wikipedia.com] (jsdom.env <- loadDocument <- clientDispatch <- dispatch <- post <- submit_$form)": function(test){
		var timeout	= 15000;
		var b		= new Browser(timeout);
		var url		= 'https://en.wikipedia.org/wiki/Hello_world';

		$test.obj	= new $test.class(test, b, 'wikipedia');

		b
			.get(url)
			.then(
				function(response){
					test.equal(
						b.redirected(),
						false
					);
					test.equal(
						b.window.location.protocol,
						'https:'
					);
					return $test.obj.assert_initial_context({"set_value":true});
				}
			)
			.then(
				function(form_fields){
					var $input, $form;

					$input	= form_fields[0];
					$input.val('hello world of tomorrow');

					$form	= $input.closest('form');
					test.equal(
						$form.length,
						1
					);
					$form.attr('method','POST');

					return b.submit_$form($form);
				}
			)
			.then( $test.obj.assert_results_page )
			.fail( $test.obj.fail )
			.done( $test.obj.done )
		;
	},

	"POST https form submission [yahoo.com] (jsdom.env <- loadDocument <- clientDispatch <- dispatch <- post <- submit_$form)": function(test){
		var timeout	= 15000;
		var jsdom_features = {
			"FetchExternalResources"	: false,
			"ProcessExternalResources"	: false,
			"SkipExternalResources"		: false
		};
		var b		= new Browser(timeout, jsdom_features);
		var url		= 'https://search.yahoo.com/search?p=hello+world';

		$test.obj	= new $test.class(test, b, 'yahoo');

		b
			.get(url)
			.then(
				function(response){
					test.equal(
						b.redirected(),
						false
					);
					test.equal(
						b.window.location.protocol,
						'https:'
					);
					return $test.obj.assert_initial_context();
				}
			)
			.then(
				function(form_fields){
					var $input, $form;

					$input	= form_fields[0];
					$input.val('hello world of tomorrow');

					$form	= $input.closest('form');
					test.equal(
						$form.length,
						1
					);
					$form.attr('method','POST');

					return b.submit_$form($form);
				}
			)
			.then( $test.obj.assert_results_page )
			.fail( $test.obj.fail )
			.done( $test.obj.done )
		;
	}

/*
	"POST https form submission [bing.com] (jsdom.env <- loadDocument <- clientDispatch <- dispatch <- post <- submit_$form)": function(test){
		var timeout	= 15000;
		var jsdom_features = {
			"FetchExternalResources"	: false,
			"ProcessExternalResources"	: false,
			"SkipExternalResources"		: false
		};
		var b		= new Browser(timeout, jsdom_features);
		var url		= 'https://www.bing.com/search?q=hello+world';

		$test.obj	= new $test.class(test, b, 'bing');

		b
			.get(url)
			.then(
				function(response){
					test.equal(
						b.redirected(),
						false
					);
					test.equal(
						b.window.location.protocol,
						'https:'
					);
					return $test.obj.assert_initial_context();
				}
			)
			.then(
				function(form_fields){
					var $input, $form;

					$input	= form_fields[0];
					$input.val('hello world of tomorrow');

					$form	= $input.closest('form');
					test.equal(
						$form.length,
						1
					);
					$form.attr('method','POST');

					return b.submit_$form($form);
				}
			)
			.then( $test.obj.assert_results_page )
			.fail( $test.obj.fail )
			.done( $test.obj.done )
		;
	}
*/

};