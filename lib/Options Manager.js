/*
ShareMeNot is licensed under the MIT license:
http://www.opensource.org/licenses/mit-license.php


Copyright (c) 2012 University of Washington

Permission is hereby granted, free of charge, to any person obtaining a
copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be included
in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

"use strict";

/* Contains Firefox-specific code. */

/* Exported Functions */
exports.getExceptions = getExceptions;
exports.isBlocked = isBlocked;
exports.replaceButtons = replaceButtons;

/**
 * Adds an exception for the tracker with the given name.
 * 
 * @param {String} trackerName the name of the tracker for which this
 *                             exception should apply
 * @param {RegExp} exception a regular expression
 */
function addException(trackerName, exception) {
	//TODO
}

/**
 * Returns an array of exceptions for the tracker with the given name.
 * 
 * @param {String} trackerName the name of the tracker
 * 
 * @return {Array} an array of regular expressions representing exceptions for
 *                 the tracker
 */
function getExceptions(trackerName) {
	return []; //TODO
}

/**
 * Returns true if the user has specified that the tracker with the given name
 * should be blocked. This represents the user's global setting.
 * 
 * @param {String} trackerName the name of the tracker
 * 
 * @return {Boolean} true if the user has specified that the tracker with the
 *                   given name should be blocked; false otherwise
 */
function isBlocked(trackerName) {
	var simplePrefs = require("sdk/simple-prefs");
	return simplePrefs.prefs["block" + trackerName + "Trackers"];
}

/**
 * Returns true if the user has specified that social buttons should be
 * replaced by local stand-in buttons. This represents the user's global setting.
 *
 * @return {Boolean} true is the user has specified that buttons should be replaced
 *                   by ShareMeNot; false otherwise
 */
function replaceButtons() {
        var simplePrefs = require("sdk/simple-prefs");
        return simplePrefs.prefs["replaceButtons"];
}


/**
 * Removes all exceptions for the tracker with the given name.
 * 
 * @param {String} trackerName the name of the tracker
 */
function removeAllExceptions(trackerName) {
	//TODO
}

/**
 * Removes the given exception for the tracker with the given name.
 * 
 * @param {String} trackerName the name of the tracker
 * @param {RegExp} exception the exception to remove
 */
function removeException(trackerName, exception) {
	//TODO
}
