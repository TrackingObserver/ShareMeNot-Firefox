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

/* Exported Functions */
exports.loadTrackersFromFile = loadTrackersFromFile;

/**
 * Loads a JSON file at filePath and returns the parsed object.
 * 
 * @param {String} filePath the path to the JSON file, relative to the
 *                          extension's data folder
 * @return {Object} the JSON at the file at filePath
 */
function loadJSONFromFile(filePath) {
	var browserAbstractionLayer = require("./Browser Abstraction Layer");
	
	var jsonString = browserAbstractionLayer.getFileContents(filePath);
	var jsonParsed = JSON.parse(jsonString);
	Object.freeze(jsonParsed); // prevent modifications to jsonParsed
	
	return jsonParsed;
}

/**
 * Returns an array of Tracker objects that are loaded from the file at
 * filePath.
 * 
 * @param {String} filePath the path to the JSON file, relative to the
 *                          extension's data folder
 * @return {Array} an array of Tracker objects that are loaded from the file at
 *                 filePath
 */
function loadTrackersFromFile(filePath) {
	var trackers = [];
	var trackersJson = loadJSONFromFile(filePath);
	
	// loop over each tracker, making a Tracker object
	for (var trackerName in trackersJson) {
		var trackerProperties = trackersJson[trackerName];
		var trackerObject = new Tracker(trackerName, trackerProperties);
		trackers.push(trackerObject);
	}
	
	return trackers;
}

/**
 * Constructs a Tracker with the given name and properties.
 * 
 * @param {String} name the name of the tracker
 * @param {Object} properties the properties of the tracker
 */
function Tracker(name, properties) {
	this.name = name;
	
	for (var property in properties) {
		this[property] = properties[property];
	}
}