/*!
 * Copyright (C) 2011 Sitelier Inc.
 * All rights reserved.
 *
 * Author: Seth Purcell
 * Date: 1/13/12
 */

"use strict";

var capsela = require('../../');
var ejs = require('../../deps/ejs/ejs.js');

var Ejs = capsela.View.extend({

},
{
    ////////////////////////////////////////////////////////////////////////////
    /**
     * 
     * @param template
     */
    init: function(template) {

        this._super(template);
        
        try {
            this.ejs = new EJS({text: template});
        }
        catch (err) {
            throw new Error("failed to create view: " + err.toString());
        }
    },

    ////////////////////////////////////////////////////////////////////////////
    /**
     * 
     */
    isComplete: function() {
        return false;
    },

    ////////////////////////////////////////////////////////////////////////////
    /**
     *
     * @param model
     */
    render: function(model) {
        return this.ejs.render(model);
    }
});

exports.Ejs = Ejs;