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
 * Initializes the popup page. (In Firefox, this is called from the browser
 * abstraction layer.)
 */
function initialize() {
	browserAbstractionLayer.getTrackerData(populateTrackerList);
	
	addButtonClickListeners();
}

/**
 * Clean up HTML when the panel is closed.
 */
function cleanHtml() {
	// Remove tracker items if they're there
	var trackerListElementPrototype = document.getElementById("trackerListElementPrototype");
    var parent = trackerListElementPrototype.parentNode;
    while (parent.firstChild) {
        parent.removeChild(parent.firstChild);
    }
    parent.appendChild(trackerListElementPrototype); // keep the prototype

	// Make conditionally visible things invisible
    var blockedTrackersMessage = document.getElementById("blockedTrackersMessage");
    blockedTrackersMessage.setAttribute("class", "hidden");
	
    var noBlockedTrackersMessage = document.getElementById("noBlockedTrackersMessage");
	noBlockedTrackersMessage.setAttribute("class", "hidden");

    
    // Move the reload warning back where it belongs
    var reloadWarningElement = document.getElementById("reloadWarning");
    var hiddenArea = document.getElementById("hiddenArea");
    hiddenArea.appendChild(reloadWarningElement);
    reloadWarningElement.removeAttribute("class");   
}

/**
 * Adds the click event listeners to the buttons on the popup that call the
 * appropriate functions.
 */
function addButtonClickListeners() {
	var unblockAllButton = document.getElementById("unblockAllButton");
	unblockAllButton.addEventListener("click", unblockAllTrackers);
	
	var reloadConfirmButton = document.getElementById("reloadConfirmButton");
	reloadConfirmButton.addEventListener("click", function() {
		browserAbstractionLayer.reloadActiveTab();
		browserAbstractionLayer.closePopup();
	});
	
	var doneButton = document.getElementById("doneButton");
	doneButton.addEventListener("click", browserAbstractionLayer.closePopup);
}

/**
 * Displays a message asking the user to reload the current page.
 * 
 * @param {Boolean} displayInTrackerList true if the message should be
 *                                       displayed in the tracker list; false
 *                                       it it should replace the "Allow all
 *                                       trackers this time" button
 */
function confirmPageReload(displayInTrackerList) {
	var reloadWarningElement = document.getElementById("reloadWarning");
	
	if (displayInTrackerList) {
		var trackerListContainer = document.getElementById("trackerListContainer");
		trackerListContainer.appendChild(reloadWarningElement);
	} else { // replace the "Allow all trackers this time" button
		var unblockAllButtonContainer = document.getElementById("unblockAllButtonContainer");
		var unblockAllButton = document.getElementById("unblockAllButton");
		
		//unblockAllButtonContainer.replaceChild(reloadWarningElement,
		//	unblockAllButton);
        unblockAllButtonContainer.appendChild(reloadWarningElement);
	}
	
	reloadWarningElement.setAttribute("class", "active");
	
	browserAbstractionLayer.resizeToFit();
}

/**
 * Populates the tracker list with each tracker and the number of web requests
 * to that tracker that were blocked.
 * 
 * @param {Object} blockTracker a map of tracker names to Boolean values saying
 *                              whether those trackers are being blocked for
 *                              the current page load
 * @param {Object} blockedTrackerCount a map of tracker names to the number of
 *                                     web requests that were blocked for those
 *                                     trackers
 */
function populateTrackerList(blockTracker, blockedTrackerCount) {
	var trackerList = document.getElementById("trackerList");
	
	var trackerListElementPrototype = document.getElementById("trackerListElementPrototype");
	
	var trackerListFragment = document.createDocumentFragment();
	
	var trackersBlocked = false; // if any trackers were blocked at all

	for (var trackerName in blockedTrackerCount) {
		var blockedTrackerCountCurrentTracker = blockedTrackerCount[trackerName];
		
		if (blockedTrackerCountCurrentTracker > 0) {
			trackersBlocked = true;
		}
		
		// clone the prototype list element
		var currentTrackerListElement = trackerListElementPrototype.cloneNode(true);
		
		// remove the ID from the cloned element
		currentTrackerListElement.removeAttribute("id");
		currentTrackerListElement.setAttribute("class", "trackerEntry");
		
		var trackerEnabledCheckbox = currentTrackerListElement.querySelector(".enabledCheckbox");
		var trackerNameContainer = currentTrackerListElement.querySelector(".trackerName");
		var blockedTrackerCountContainer = currentTrackerListElement.querySelector(".blockedTrackerCount");
		
		// if the current tracker should be blocked, check the checkbox
		if (blockTracker[trackerName]) {
			trackerEnabledCheckbox.setAttribute("checked", true);
		}
		
		// add the change event listener to the checkbox and provide the
		// tracker name as an argument to the callback function
		trackerEnabledCheckbox.addEventListener("change",
				updateTrackerEnabledStatus.bind(this, trackerName));
		
		trackerNameContainer.textContent = trackerName;
		blockedTrackerCountContainer.textContent = blockedTrackerCountCurrentTracker;

		trackerListFragment.appendChild(currentTrackerListElement);
	}
	
	if (trackersBlocked) {
		var blockedTrackersMessage = document.getElementById("blockedTrackersMessage");
		blockedTrackersMessage.removeAttribute("class");
	} else { // no trackers were blocked
		var noBlockedTrackersMessage = document.getElementById("noBlockedTrackersMessage");
		noBlockedTrackersMessage.removeAttribute("class");
	}
	
	//trackerList.replaceChild(trackerListFragment, trackerListElementPrototype);
    trackerList.appendChild(trackerListFragment);
	
	browserAbstractionLayer.resizeToFit();
}

/**
 * Updates the enabled status for the given tracker for the tab to which this
 * popup belongs.
 * 
 * @param {String} trackerName the name of the tracker that needs its status
 *                             updated
 * @param {Event} event the change event coming from the checkbox that is
 *                      associated with the tracker's enabled status
 */
function updateTrackerEnabledStatus(trackerName, event) {
	var checked = event.target.checked;
	
	if (!checked) {
		browserAbstractionLayer.unblockTrackerOnActiveTab(trackerName);
	} else { // checked
		browserAbstractionLayer.blockTrackerOnActiveTab(trackerName);
	}
	
	confirmPageReload(true);
}

/**
 * Unblocks all the trackers on the tab to which this popup belongs.
 */
function unblockAllTrackers() {
	browserAbstractionLayer.unblockAllTrackersOnActiveTab();
	
	confirmPageReload(false);
}
