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
 * Contains Firefox-specific code for the content script.
 */

var browserAbstractionLayer = (function() {
	var exports = {};
	
	/**
	 * Gets data about which tracker buttons need to be replaced from the main
	 * extension and passes it to the provided callback function.
	 * 
	 * @param {Function} callback the function to call when the tracker data is
	 *                            received; the arguments passed are the folder
	 *                            containing the content script, the tracker
	 *                            data, and a mapping of tracker names to
	 *                            whether those tracker buttons need to be
	 *                            replaced
	 */
	exports.getTrackerData = function(callback) {
		self.port.emit("contentScriptReady");
		self.port.on("contentScriptData", function(response) {
			assert(response !== null);
			
			var contentScriptFolderUrl = response.contentScriptFolderUrl;
			var trackers = response.trackers;
			var trackerButtonsToReplace = response.trackerButtonsToReplace;
			
			callback(contentScriptFolderUrl, trackers, trackerButtonsToReplace);
		});
	}
	
	/**
	 * Unblocks the tracker with the given name from the page. Calls the
	 * provided callback function after the tracker has been unblocked.
	 * 
	 * @param {String} trackerName the name of the tracker to unblock
	 * @param {Function} callback the function to call after the tracker has
	 *                            been unblocked
	 */
	exports.unblockTracker = function(trackerName, callback) {
		self.port.emit("unblockTracker", trackerName);
		self.port.on("trackerUnblocked", callback);
	}
	
	return exports;
}());