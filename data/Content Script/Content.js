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
 * The relative path from the content script folder to the replacement buttons
 * folder.
 */
var REPLACEMENT_BUTTONS_FOLDER_PATH = "Replacement Buttons/";

/**
 * The relative path from the content script folder to the stylesheet that is
 * injected into every page.
 */
var CONTENT_SCRIPT_STYLESHEET_PATH = "Content.css";

/**
 * The absolute URL to the content script folder within the extension.
 */
var contentScriptFolderUrl;

/**
 * Initializes the content script.
 */
function initialize() {
	browserAbstractionLayer.getTrackerData(function (contentScriptFolderUrl2,
			trackers, trackerButtonsToReplace) {
		contentScriptFolderUrl = contentScriptFolderUrl2;
		
		// add the Content.css stylesheet to the page
		var head = document.querySelector("head");
		var stylesheetLinkElement = getStylesheetLinkElement(contentScriptFolderUrl
			+ CONTENT_SCRIPT_STYLESHEET_PATH);
		head.appendChild(stylesheetLinkElement);
			
		replaceTrackerButtonsHelper(trackers, trackerButtonsToReplace);
	});
}

/**
 * Creates a replacement button element for the given tracker.
 *
 * @param {Tracker} tracker the Tracker object for the button
 * 
 * @return {Element} a replacement button element for the tracker
 */
function createReplacementButtonImage(tracker) {
	var buttonData = tracker.replacementButton;

	var button = document.createElement("img");
	
	var buttonUrl = getReplacementButtonUrl(buttonData.imagePath);
	var buttonType = buttonData.type;
	var details = buttonData.details;
	
	button.setAttribute("src", buttonUrl);
	button.setAttribute("class", "sharemenotReplacementButton");
	
	switch (buttonType) {
		case 0: // normal button type; just open a new window when clicked
			var popupUrl = details + encodeURIComponent(window.location.href);
			
			button.addEventListener("click", function() {
				window.open(popupUrl);
			});
		break;
		
		case 1: // in place button type; replace the existing button with an
		        // iframe when clicked
			var iframeUrl = details + encodeURIComponent(window.location.href);
			
			button.addEventListener("click", function() {
				// for some reason, the callback function can execute more than
				// once when the user clicks on a replacement button
				// (it executes for the buttons that have been previously
				// clicked as well)
				replaceButtonWithIframeAndUnblockTracker(button, tracker, iframeUrl);
			});
		break;
		
		case 2: // in place button type; replace the existing button with code
		        // specified in the Trackers file
			button.addEventListener("click", function() {
				// for some reason, the callback function can execute more than
				// once when the user clicks on a replacement button
				// (it executes for the buttons that have been previously
				// clicked as well)
				replaceButtonWithHtmlCodeAndUnblockTracker(button, tracker, details);
			});
		break;
		
		default:
			throw "Invalid button type specified: " + buttonType;
		break;
	}
	
	return button;
}

/**
 * Returns the absolute URL of a replacement button given its relative path
 * in the replacement buttons folder.
 * 
 * @param {String} replacementButtonLocation the relative path of the
 * replacement button in the replacement buttons folder
 * 
 * @return {String} the absolute URL of a replacement button given its relative
 * path in the replacement buttons folder
 */
function getReplacementButtonUrl(replacementButtonLocation) {	
	return contentScriptFolderUrl + REPLACEMENT_BUTTONS_FOLDER_PATH +
		replacementButtonLocation;
}

/**
 * Returns a HTML link element for a stylesheet at the given URL.
 * 
 * @param {String} URL the URL of the stylesheet to link
 * 
 * @return {Element} the HTML link element for a stylesheet at the given URL
 */
function getStylesheetLinkElement(url) {
	var linkElement = document.createElement("link");
	
	linkElement.setAttribute("rel", "stylesheet");
	linkElement.setAttribute("type", "text/css");
	linkElement.setAttribute("href", url);
	
	return linkElement;
}

/**
 * Unblocks the given tracker and replaces the given button with an iframe
 * pointing to the given URL.
 * 
 * @param {Element} button the DOM element of the button to replace
 * @param {Tracker} tracker the Tracker object for the tracker that should be
 *                          unblocked
 * @param {String} iframeUrl the URL of the iframe to replace the button
 */
function replaceButtonWithIframeAndUnblockTracker(button, tracker, iframeUrl) {
	browserAbstractionLayer.unblockTracker(tracker, function() {
		// check is needed as for an unknown reason this callback function is
		// executed for buttons that have already been removed; we are trying
		// to prevent replacing an already removed button
		if (button.parentNode !== null) { 
			var iframe = document.createElement("iframe");
			
			iframe.setAttribute("src", iframeUrl);
			iframe.setAttribute("class", "sharemenotOriginalButton");
		
			button.parentNode.replaceChild(iframe, button);
		}
	});
}

/**
 * Unblocks the given tracker and replaces the given button with the 
 * HTML code defined in the provided Tracker object.
 * 
 * @param {Element} button the DOM element of the button to replace
 * @param {Tracker} tracker the Tracker object for the tracker that should be
 *                          unblocked
 * @param {String} html the HTML code that should replace the button
 */
function replaceButtonWithHtmlCodeAndUnblockTracker(button, tracker, html) {
	browserAbstractionLayer.unblockTracker(tracker, function() {
		// check is needed as for an unknown reason this callback function is
		// executed for buttons that have already been removed; we are trying
		// to prevent replacing an already removed button
		if (button.parentNode !== null) { 
			var codeContainer = document.createElement("div");
			codeContainer.innerHTML = html;
			
			button.parentNode.replaceChild(codeContainer, button);

			replaceScriptsRecurse(codeContainer);
			
			button.removeEventListener("click");
		}
	});
}

/**
 * Dumping scripts into innerHTML won't execute them, so replace them
 * with executable scripts.
 */
function replaceScriptsRecurse(node) {
        if (node.getAttribute && node.getAttribute("type") == "text/javascript") {
                var script  = document.createElement("script");
                script.text = node.innerHTML;
                script.src = node.src;
                node.parentNode.replaceChild(script, node);
        } else {
                var i = 0;
                var children = node.childNodes;
                while ( i < children.length) {
                        replaceScriptsRecurse(children[i]);
                        i++;
                }
        }
        return node;
}

/**
 * Replaces all tracker buttons on the current web page with the internal
 * replacement buttons, respecting the user's blocking settings.
 * 
 * @param {Array} trackers an array of Tracker objects
 * @param {Object} a map of Tracker names to Boolean values saying whether
 *                 those trackers' buttons should be replaced
 */
function replaceTrackerButtonsHelper(trackers, trackerButtonsToReplace) {
	trackers.forEach(function(tracker) {
		var replaceTrackerButtons = trackerButtonsToReplace[tracker.name];
				
		if (replaceTrackerButtons) {			
			// makes a comma separated list of CSS selectors that specify
			// buttons for the current tracker; used for document.querySelectorAll
			var buttonSelectorsString = tracker.buttonSelectors.toString();
			var buttonsToReplace =
				document.querySelectorAll(buttonSelectorsString);
			
			for (var i = 0; i < buttonsToReplace.length; i++) {
				var buttonToReplace = buttonsToReplace[i];
				
				var button =
					createReplacementButtonImage(tracker);
				
				buttonToReplace.parentNode.replaceChild(button, buttonToReplace);
			}
		}
	});
}

initialize();
