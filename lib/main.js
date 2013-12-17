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
 * The path to the tracker definitions file, relative to the extension's data
 * directory. The tracker definitions file contains URL match patterns for
 * requests that should be blocked, as well as CSS selectors to identify
 * buttons on web pages that should be replaced.
 */
var TRACKERS_FILE_PATH = "Trackers.json";

/**
 * The path to the content script folder, relative to the extension's data
 * directory.
 */
var CONTENT_SCRIPT_FOLDER_PATH = "Content Script/";

/**
 * The paths of the content scripts to inject into every page, relative to the
 * extension's data directory.
 */
var CONTENT_SCRIPT_PATHS = ["Content Script/Browser Abstraction Layer.js",
                       "Content Script/Content.js"];

/**
 * An array of Tracker objects specifying the supported trackers from the
 * Trackers file.
 *
 * @type {Array}
 */
var trackers;

/**
 * A map from tabs to tracker blocking information for each tab. Tabs are
 * mapped to an anonymous object with the property "blockTracker".
 * blockTracker is itself an anonymous object that maps individual Tracker
 * objects to a boolean value saying if the user has requested that that
 * Tracker be allowed *just for the current tab*. The boolean value doesn't
 * reflect the global unblocking/blocking setting for each tracker. It only
 * reflects site exceptions and any trackers the user has unblocked for the
 * current tab only.
 * 
 * @type {Object}
 */
var tabInfo;

/**
 * Initializes ShareMeNot.
 */
exports.main = function() {
	tabInfo = {};
	
	var filePaths = require("./File Paths");
	
	var trackerFileLoader = require("./Tracker File Loader");
	trackers = trackerFileLoader.loadTrackersFromFile(filePaths.TRACKERS_FILE);
	
	var browserAbstractionLayer = require("./Browser Abstraction Layer");
	browserAbstractionLayer.initialize(trackers);
	browserAbstractionLayer.setTabInfoUpdaterCallback(updateTabInfo);
	browserAbstractionLayer.setTabBlockingFunctions(blockTrackerOnTab,
		unblockTrackerOnTab, unblockAllTrackersOnTab);
	browserAbstractionLayer.setGetDataForPopupFunction(getDataForPopup);
	
	browserAbstractionLayer.addWebRequestFilter(filterRequest);
	browserAbstractionLayer.addContentScriptInserter(filePaths.CONTENT_SCRIPTS,
		getDataForContentScript);
	
}

/**
 * Blocks the tracker with the given name on the tab with the given tab ID.
 * 
 * @param tabId the ID of the tab
 * @param trackerName the name of the tracker to block
 */
function blockTrackerOnTab(tabId, trackerName) {
	if (tabId !== undefined && tabInfo[tabId] !== undefined) {
		//console.log("Blocking tracker " + trackerName + " on tab with ID " + tabId);
		tabInfo[tabId].blockTracker[trackerName] = true;
	}
}

/**
 * Filters web requests. Called by the browser abstraction layer.
 * 
 * @param {Number} tabId the ID of the tab of the request to filter
 * @param {String} url the URL of the web request
 * @param {Tracker} tracker the tracker that belongs to this web request
 * 
 * @return {Boolean} true if the request should be blocked; false otherwise
 */
function filterRequest(tabId, url, tracker) {
	var browserAbstractionLayer = require("./Browser Abstraction Layer");
	
	var optionsManager = require("./Options Manager");
	var trackerBlockedGlobally = optionsManager.isBlocked(tracker.name);
	
	var trackerBlockedForTab;
	
	if (tabId === null) {
		trackerBlockedForTab = true;
	} else {
		trackerBlockedForTab = tabInfo[tabId].blockTracker[tracker.name];
	}
	
	var trackerExceptions = optionsManager.getExceptions(tracker.name);
	var urlExcluded = stringMatchesRegexArray(trackerExceptions, url);

	var trackerOwnPage = false;
	if (tabId !== null && tabInfo[tabId].url !== null) {
		var strippedUrl = tabInfo[tabId].url.split('//')[1].split('/')[0];
		trackerOwnPage = strippedUrl.indexOf(tracker.domain, strippedUrl.length - tracker.domain.length) !== -1;
	}
	
	if (trackerBlockedGlobally && trackerBlockedForTab && !urlExcluded && !trackerOwnPage) {
		tabInfo[tabId].blockedTrackerCount[tracker.name] += 1;
		
		browserAbstractionLayer.showTrackerBlockedIcon(tabId);	
		//console.log("Blocked request to " + url + " on tab with url " + tabInfo[tabId].url);
		
		return true;
	} else {
		//console.log("Did not block request to " + url);
		
		return false;
	}
}

/**
 * Returns an object with the trackers, which trackers' buttons to replace, and
 * the URL of the content script folder. Used by the content script.
 * 
 * @param {Number} tabId the ID of the tab on which the content script is
 *                 running
 * 
 * @return {Object} an object with the trackers, which trackers' buttons to
 *                  replace, and the URL of the content script folder
 */
function getDataForContentScript(tabId) {
	if (tabId !== undefined && tabInfo[tabId] !== undefined) {
		var optionsManager = require("./Options Manager");
		
		// a mapping of individual Tracker objects to boolean values
		// saying if the content script should replace that tracker's
		// buttons (much like the "blockTracker" property in
		// tabInfo, but taking into account if the user has disabled
		// blocking for that tracker in the options page)
		var trackerButtonsToReplace = {};
		
		trackers.forEach(function(tracker) {
			// setting from the options page that applies to all tabs
			var trackerBlockedGlobally = optionsManager.isBlocked(tracker.name);
			var replace = optionsManager.replaceButtons();
			
			var trackerBlockedForTab = tabInfo[tabId].blockTracker[tracker.name];
			
			trackerButtonsToReplace[tracker.name] =
				replace && trackerBlockedGlobally && trackerBlockedForTab;
		});
		
		var browserAbstractionLayer = require("./Browser Abstraction Layer");
		var filePaths = require("./File Paths");
		var contentScriptFolderUrl =
			browserAbstractionLayer.getFullUrl(filePaths.CONTENT_SCRIPT_FOLDER);
		
		return {
			"trackers" : trackers,
			"trackerButtonsToReplace" : trackerButtonsToReplace,
			"contentScriptFolderUrl": contentScriptFolderUrl
		};
	} else {
		//console.log("No tab info for tab " + tabId + " defined.");
		return null;
	}
}

/**
 * Returns the count of the trackers blocked and whether tab blocking is
 * enabled for the tab with the given tab ID.
 * 
 * @param {Number} tabId the ID of the tab
 * 
 * @return {Object} the count of the trackers blocked and whether tab blocking
 *                  is enabled for the tab with the given tab ID; null if an
 *                  invalid tab ID is given
 */
function getDataForPopup(tabId) {
	if (tabId !== undefined && tabInfo[tabId] !== undefined) {
		var blockedTrackerCount = {};
		var optionsManager = require("./Options Manager");
		
		for (var trackerName in tabInfo[tabId].blockedTrackerCount) {
			if (optionsManager.isBlocked(trackerName)) {
				blockedTrackerCount[trackerName] = tabInfo[tabId].blockedTrackerCount[trackerName];
			}
		}
		
		//console.log("Responding to add-on bar popup request.");
		
		return {
			"blockedTrackerCount" : blockedTrackerCount,
			"blockTracker" : tabInfo[tabId].blockTracker
		};		
	} else {
		//console.log("Didn't respond to add-on bar popup request.");
		
		return null;
	}
}

/**
 * Returns true if the given string matches any expression in the given array
 * of regular expressions.
 * 
 * @param {Array} regexArray the array of regular expressions
 * @param {String} string the string to test against the array of regular
 *                        expressions
 * 
 * @return {Boolean} true if the given string matches any expression in the
 *                   given array of regular expressions; false otherwise
 */
function stringMatchesRegexArray(regexArray, string) {
	var match;
	
	regexArray.some(function (regex) {
		match = (string.search(regex) !== -1);
		return match;
	});
	
	return match;
}

/**
 * Resets the tab info of the tab with the given ID based on a top-level
 * request from that tab to the given URL if necessary.
 * 
 * @param {Number} tabId the ID of the tab
 * @param {String} url the URL of a top-level request coming from the tab
 */
function updateTabInfo(tabId, url) {
	// update the tabInfo for the tab
	// only update the tabInfo if the user has navigated to a
	// different URL in the same tab (needed because ShareMeNot
	// can refresh the page to allow a blocked tracker)
	if (tabId !== null &&
			(tabInfo[tabId] === undefined || tabInfo[tabId].url !== url)) {
		//console.log("tabInfo updated for tab with URL <" + tab.url + ">:");
		
		//console.log("Resetting tab info on tab " + tabId);

		tabInfo[tabId] = {};
		tabInfo[tabId].url = url;
		tabInfo[tabId].blockTracker = {};
		tabInfo[tabId].blockedTrackerCount = {};

		
		var optionsManager = require("./Options Manager");
		
		//var browserAbstractionLayer = require("./Browser Abstraction Layer");
		//browserAbstractionLayer.resetTrackerBlockedIconOnTab(tabId);
		
		trackers.forEach(function (tracker) {
			tabInfo[tabId].blockTracker[tracker.name] = true;
			
			//TODO: reset when the user reloads the page
			tabInfo[tabId].blockedTrackerCount[tracker.name] = 0;
		});
	}
}

/**
 * Unblocks all trackers on the tab with the given tab ID.
 * 
 * @param tabId the ID of the tab
 */
function unblockAllTrackersOnTab(tabId) {
	if (tabId !== undefined && tabInfo[tabId] !== undefined) {
		for (var trackerName in tabInfo[tabId].blockTracker) {
			tabInfo[tabId].blockTracker[trackerName] = false;
		}
	}
}

/**
 * Unblocks the tracker with the given name on the tab with the given tab ID.
 * 
 * @param tabId the ID of the tab
 * @param trackerName the name of the tracker to unblock
 */
function unblockTrackerOnTab(tabId, trackerName) {
	if (tabId !== undefined && tabInfo[tabId] !== undefined) {
		//console.log("Unblocking tracker " + trackerName + " on tab with ID " + tabId);
		tabInfo[tabId].blockTracker[trackerName] = false;
	}
}
