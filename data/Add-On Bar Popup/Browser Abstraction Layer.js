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

/**
 * Contains Firefox-specific code for the popup page.
 */

// only call the initialize function when the popup is shown (the popup is
// loaded when Firefox starts, even if it isn't visible)
addon.port.on("open", initialize); 

// reload the popup when it is closed (otherwise it will stay open in Firefox)
addon.port.on("hide", cleanHtml);

var browserAbstractionLayer = (function() {
	var exports = {};
	
	/**
	 * Blocks the tracker with the specified name on the active tab (i.e.,
	 * the one that contains this popup window).
	 * 
	 * @param {String} trackerName the name of the tracker to block
	 */
	exports.blockTrackerOnActiveTab = function(trackerName) {
		addon.port.emit("blockTrackerOnActiveTab", trackerName);
	}
	
	/**
	 * Closes the popup window.
	 */
	exports.closePopup = function() {
		addon.port.emit("close");
	}
	
	/**
	 * Gets the tracker blocking data from the main extension. Calls the
	 * provided callback function with the tracker blocking data.
	 * 
	 * @param {Function} callback the callback function that processes the
	 *                   tracker blocking data
	 */
	exports.getTrackerData = function(callback) {
		addon.port.emit("popupInitialize");
		addon.port.once("popupInitializeResponse", function(response) {
			if (response !== null) {
				var blockedTrackerCount = response.blockedTrackerCount;
				var blockTracker = response.blockTracker;
				callback(blockTracker, blockedTrackerCount);
			} else { // no tracker data for the active tab
				callback(null, null);
			}
		});
	}
	
	/**
	 * Reloads the tab that contains this popup window.
	 */
	exports.reloadActiveTab = function() {
		addon.port.emit("reloadActiveTab");
	}
	
	/**
	 * Resizes the popup window to fit its contents.
	 */
	exports.resizeToFit = function() {
		var details = {
			width: document.documentElement.scrollWidth,
			height: document.documentElement.scrollHeight
		};
		addon.port.emit("resizeToFit", details);
	}
	
	/**
	 * Unblocks all trackers on the active tab (i.e., the one that contains
	 * this popup window).
	 */
	exports.unblockAllTrackersOnActiveTab = function() {
		addon.port.emit("unblockAllTrackersOnActiveTab");
	}
	
	/**
	 * Unblocks the tracker with the specified name on the active tab (i.e.,
	 * the one that contains this popup window).
	 * 
	 * @param {String} trackerName the name of the tracker to unblock
	 */
	exports.unblockTrackerOnActiveTab = function(trackerName) {
		addon.port.emit("unblockTrackerOnActiveTab", trackerName);
	}
	
	return exports;
}());
