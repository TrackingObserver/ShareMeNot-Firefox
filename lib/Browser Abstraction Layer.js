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

/* Global Variables */
var blockTrackerOnTab;
var getDataForPopup;
var tabCount;
var tabInfoUpdaterCallback;
var unblockAllTrackersOnTab;
var unblockTrackerOnTab;
var urlPatternsToTrackersMap;

//var trackerBlockedIconTabVisibility;
//var trackerBlockedIcon;

/* Exported Functions */
exports.initialize = initialize;
exports.addContentScriptInserter = addContentScriptInserter;
exports.addWebRequestFilter = addWebRequestFilter;
exports.getFileContents = getFileContents;
exports.getFullUrl = getFullUrl;
exports.setGetDataForPopupFunction = setGetDataForPopupFunction;
exports.setTabBlockingFunctions = setTabBlockingFunctions;
exports.setTabInfoUpdaterCallback = setTabInfoUpdaterCallback;
exports.showTrackerBlockedIcon = showTrackerBlockedIcon;
//exports.hideTrackerBlockedIcon = hideTrackerBlockedIcon;

/**
 * Initializes the browser abstraction layer for the main extension.
 * 
 * @param {Array} trackers an array of Tracker objects representing the
 *                         trackers blocked by this extension
 */
function initialize(trackers) {
	// assign a unique ID for each opened tab
	// take care of the first tab (which doesn't emit an open event);
	
	tabCount = 0;
	var tabs = require("tabs");
	tabs.activeTab.sharemenotId = tabCount;
	tabCount++;
	
	tabs.on("open", function(tab) {
		tab.sharemenotId = tabCount;
		tabCount++;
	});
	
	// create URL patterns to trackers map, so we can tell which tracker
	// belongs to a blocked web request	
	urlPatternsToTrackersMap = createUrlPatternsToTrackersMap(trackers);
	
	createTrackerBlockedIcon();
	
	//TODO: set tab activate/deactivate event listeners and show/hide the widget if necessary
	/*trackerBlockedIconTabVisibility = {};
	var tabs = require("tabs");
	tabs.on("activate", updateTrackerBlockedIconVisibility);
	tabs.on("deactivate", removeIconOnDeactivate);*/
}

/**
 * Makes the content script be injected to every page that loads.
 * 
 * @param {Array} contentScriptPaths an array of paths of content scripts to
 *                                   be injected into every page that loads
 * @param {Function} getDataForContentScriptCallback the function that should
 *                                                   be called to get the data
 *                                                   for the content script
 */
function addContentScriptInserter(contentScriptPaths, getDataForContentScriptCallback) {
	var pageMod = require("page-mod");
	
	var contentScriptFullPaths = [];
	contentScriptPaths.forEach(function (contentScriptPath) {
		var contentScriptFullPath = getFullUrl(contentScriptPath);
		contentScriptFullPaths.push(contentScriptFullPath);
	});
	
	pageMod.PageMod({
		include: ["*"],
		contentScriptWhen: "ready",
		contentScriptFile: contentScriptFullPaths,
		onAttach: function(worker) {
			// the worker object is used to communicate between the main
			// extension code and the content script code
			
			// the tab of the content script that sent the event
			var tab = worker.tab;
			
			// "contentScriptReady" is sent by the content script when it is
			// initializing; send the content script a list of which tracker
			// buttons to replace (i.e., which trackers were blocked when the
			// page loaded)
			worker.port.on("contentScriptReady", function(html) {
				//TODO: don't execute the content script if we're in an iframe
				// that we specifically loaded (minor performance improvement)
				
				//console.log("Getting data for content script for tab " + tab.sharemenotId);
				var contentScriptData = getDataForContentScriptCallback(tab.sharemenotId);
				
				if (contentScriptData !== null) {
					worker.port.emit("contentScriptData", contentScriptData);
				}
			});
			
			// "unblockTracker" sent when the content script wants to unblock a
			// tracker for its tab
			worker.port.on("unblockTracker", function (tracker) {
				unblockTrackerOnTab(tab.sharemenotId, tracker.name);
				
				worker.port.emit("trackerUnblocked");
			});	
		}
	});
}

/**
 * Adds the web request filter. Blocks requests or allows them.
 * 
 * @param {Function} callback the function that should be called to determine
 *                            whether a request should be blocked or not
 */
function addWebRequestFilter(callback) {
	var observer = require("observer-service");
	observer.add("http-on-modify-request", function (subject, topic, data) {
		var {Ci} = require("chrome");
		subject.QueryInterface(Ci.nsIHttpChannel);
		
		var optionsManager = require("./Options Manager");
		
		var url = subject.URI.spec;
		
		var window = getWindowFromChannel(subject);
		
		// the tab that originated the request that is currently being filtered
		var tab;
		if (window === null) {
			tab = null;
		} else {
			var tabs = require("sdk/tabs/helpers.js");
			tab = tabs.getTabForWindow(window);
			
			if (tab !== null) {
				tabInfoUpdaterCallback(tab.sharemenotId, tab.url);
			}
		}
		
		var trackerForRequest = getTrackerFromRequestUrl(url);
		
		var filterRequest;
		
		if (trackerForRequest !== null) {
			filterRequest = callback(tab.sharemenotId, url, trackerForRequest);
		} else {
			filterRequest = false;
		}
		
		if (filterRequest) {
			// Block the request only if the user has replaceButtons selected.
			// Otherwise, just remove cookies from the request.
			if (optionsManager.replaceButtons()) {
				//console.log("Blocking request to " + url);
				var {Cr} = require("chrome");
				subject.cancel(Cr.NS_BINDING_ABORTED); // cancel the request
			} else {
				//console.log("Removed cookie from " + url);
				// Remove cookie header
				subject.setRequestHeader("Cookie", "", false);
			}
		} else {
			//console.log("Allowing request to " + url);
			// Allow the request; don't need to do anything special
		}
	});
}

/**
 * Creates the tracker blocked icon.
 */
function createTrackerBlockedIcon() {
	var tabs = require("tabs");
	var panel = require("panel");
	var widget = require("widget");
	var data = require("self").data;
	var filePaths = require("./File Paths");
	
	var popup = panel.Panel({
		contentScriptWhen: "ready",
		contentURL: data.url(filePaths.POPUP)
	});
	
	var addonBarIcon = widget.Widget({
		id: "addonBarIcon",
		label: "ShareMeNot",
		contentURL: data.url(filePaths.WIDGET),
		panel: popup
	});
	
	// listeners for events from the browser responding to the user showing
	// and hiding the popup
	popup.on("show", function() {
		popup.port.emit("open");
	});
	popup.on("hide", function() {
		popup.port.emit("hide");
	});
	
	// listeners for messages coming from the popup page
	popup.port.on("popupInitialize", function() {
		var activeTabId = tabs.activeTab.sharemenotId;
		var popupData = getDataForPopup(activeTabId);
		popup.port.emit("popupInitializeResponse", popupData);
	});
	
	popup.port.on("reloadActiveTab", function() {
		var activeTab = tabs.activeTab;
		activeTab.reload();
	});
	
	popup.port.on("blockTrackerOnActiveTab", function(trackerName) {
		var activeTabId = tabs.activeTab.sharemenotId;
		blockTrackerOnTab(activeTabId, trackerName);
	});
	popup.port.on("unblockTrackerOnActiveTab", function(trackerName) {
		var activeTabId = tabs.activeTab.sharemenotId;
		unblockTrackerOnTab(activeTabId, trackerName);
	});
	popup.port.on("unblockAllTrackersOnActiveTab", function() {
		var activeTabId = tabs.activeTab.sharemenotId;
		unblockAllTrackersOnTab(activeTabId);
	});
	
	popup.port.on("resizeToFit", function(details) {
		var width = details.width;
		var height = details.height;
		popup.resize(width, height);
	});
	
	popup.port.on("close", function() {
		popup.hide();
	});
	
	//trackerBlockedIcon = addonBarIcon;
}

/**
 * Initializes the URL patterns to Tracker objects map.
 * 
 * @param {Array} trackers the array of Tracker objects
 * 
 * @return {Object} a mapping of URL patterns to Tracker objects
 */
function createUrlPatternsToTrackersMap(trackers) {
	var urlPatternsToTrackersMap = {};
	
	trackers.forEach(function(tracker) {
		var matchPatterns = tracker.matchPatterns;
		
		matchPatterns.forEach(function(matchPattern) {
			// the patterns in the Trackers file are match patterns, but we
			// need regular expressions, so replace "*" with ".*"
			var regex = matchPattern.replace(/\*/g, ".*");
			urlPatternsToTrackersMap[regex] = tracker;
		});
	});
	
	return urlPatternsToTrackersMap;
}

/**
 * Returns the contents of the file at filePath.
 * 
 * @param {String} filePath the path to the file
 * 
 * @return {String} the contents of the file
 */
function getFileContents(filePath) {
	var self = require("self");
	return self.data.load(filePath);
}

/**
 * Returns the full absolute URL of a file based on its partial path within the
 * extension.
 * 
 * @param {String} partialUrl the partial path of the file
 * 
 * @return {String} the full absolute URL of the file
 */
function getFullUrl(partialUrl) {
	var self = require("self");
	return self.data.url(partialUrl);
}

/**
 * Gets the tracker associated the provided URL.
 * 
 * @param {String} url the url for which to find the associated tracker
 * 
 * @return {Tracker} the tracker associated with the provided URL; null if
 *                   there is no associated tracker
 */
function getTrackerFromRequestUrl(url) {
	// go through each regular expression in urlPatternsToTrackersMap, seeing
	// if any match the request URL
	for (var pattern in urlPatternsToTrackersMap) {
		var match = (url.search(pattern) !== -1);
		if (match) {
			return urlPatternsToTrackersMap[pattern];
		}
	}
	
	return null;
}

/**
 * Returns the top window associated with a request channel. Returns null if
 * there is no associated window.
 * 
 * @param {nsIChannel} the request channel for which to find the associated top
 *                     window
 * 
 * @return {nsWindow} the top window associated with the request channel
 */
function getWindowFromChannel(channel) {
	var {Ci} = require("chrome");
	
	var loadContext;
	
	try {  
		loadContext = channel.QueryInterface(Ci.nsIChannel).notificationCallbacks.
			getInterface(Ci.nsILoadContext);  
	} catch (e) {  
		try {  
			loadContext = channel.loadGroup.notificationCallbacks.getInterface(Ci.nsILoadContext);  
		} catch (e) {  
			return null; 
		}  
	}  
	
	return loadContext.associatedWindow.top;
}

/**
 * Sets the function that gets the data for the popup window.
 * 
 * @param {Function} getDataForPopup2 the function that gets the data for the
 *                                    popup window
 */
function setGetDataForPopupFunction(getDataForPopup2) {
	getDataForPopup = getDataForPopup2;
}

/**
 * Sets the functions that manage tracker blocking and unblocking on tabs.
 * 
 * @param {Function} blockTrackerOnTab2 the function that blocks a tracker on a
 *                                      specific tab
 * @param {Function} unblockTrackerOnTab2 the function that unblocks a tracker
 *                                      on a specific tab
 * @param {Function} unblockAllTrackersOnTab2 the function that unblocks all
 *                                      trackers on a specific tab
 */
function setTabBlockingFunctions(blockTrackerOnTab2, unblockTrackerOnTab2,
		unblockAllTrackersOnTab2) {
	blockTrackerOnTab = blockTrackerOnTab2;
	unblockTrackerOnTab = unblockTrackerOnTab2;
	unblockAllTrackersOnTab = unblockAllTrackersOnTab2;
}

/**
 * Sets the function that updates the internal tabInfo array mapping tabs to
 * data about them.
 * 
 * @param {Function} callback the function that updates the internal tabInfo
 *                            array mapping tabs to data about them
 */
function setTabInfoUpdaterCallback(callback) {
	tabInfoUpdaterCallback = callback;
}

/**
 * Shows the tracker blocked icon on the tab with the given ID.
 * 
 * @param {Number} the ID of the tab on which to show the tracker blocked icon
 */
function showTrackerBlockedIcon(tabId) {
	// for future use
}

/* For future implementation of showing and hiding the add-on bar icon when
 * switching tabs
function hideTrackerBlockedIcon() {
	if (trackerBlockedIcon) {
		trackerBlockedIcon.destroy();
		trackerBlockedIcon = null;
	}
}

function resetTrackerBlockedIconOnTab(tabId) {
	trackerBlockedIconTabVisibility[tabId] = false;
	hideTrackerBlockedIcon();
}

exports.resetTrackerBlockedIconOnTab = resetTrackerBlockedIconOnTab;

function showTrackerBlockedIcon(tabId) {
	// TODO: check if tab is the active tab; if so, show the widget; otherwise, store that it should be shown
	//console.log("Need to show tracker blocked icon for tab with URL "  + tab.url);
	trackerBlockedIconTabVisibility[tabId] = true;
	
	var tabs = require("tabs");
	//console.log(tab.url + "--" + tabs.activeTab.url);
	var tabIsActiveTab = (tabId === tabs.activeTab.sharemenotId);
	if (tabIsActiveTab && !trackerBlockedIcon) {
		//console.log("showTrackerBlockedIcon");
		createTrackerBlockedIcon();
	}
}

function removeIconOnDeactivate(deTab) {
	hideTrackerBlockedIcon();
}

function updateTrackerBlockedIconVisibility(activatedTabId) {
	var tabs = require("tabs");
	var activeTabId = tabs.activeTab.sharemenotId;
	if (trackerBlockedIconTabVisibility[activeTabId]) {
		createTrackerBlockedIcon();
	} else {
		//console.log("Should destroy icon because of tab switch");
		hideTrackerBlockedIcon();
	}
}*/
