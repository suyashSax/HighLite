/**
 * Copyright 2017, Google, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

// [START videointelligence_quickstart]
// Imports the Google Cloud Video Intelligence library
const Video = require('@google-cloud/video-intelligence');

// Instantiates a client
const video = Video();

// The GCS filepath of the video to analyze
const gcsUri = 'gs://io-video1/trevorNoah.mp4';

// Construct request
const request = {
  inputUri: gcsUri,
  features: ['SHOT_CHANGE_DETECTION']
};

// Execute request
video.annotateVideo(request)
.then((results) => {
  const operation = results[0];
  console.log('Waiting for operation to complete...');
  return operation.promise();
})
.then((results) => {
  // Gets shot changes
  const shotChanges = results[0].annotationResults[0].shotAnnotations;
  console.log('Shot changes:');

var res = []
  if (shotChanges.length === 1) {
    console.log(`The entire video is one shot.`);
  } else {
    shotChanges.forEach((shot, shotIdx) => {

      console.log(`Scene ${shotIdx} occurs from:`);
      if (shot.startTimeOffset === undefined) {
        shot.startTimeOffset = {};
      }
      if (shot.endTimeOffset === undefined) {
        shot.endTimeOffset = {};
      }
      if (shot.startTimeOffset.seconds === undefined) {
        shot.startTimeOffset.seconds = 0;
      }
      if (shot.startTimeOffset.nanos === undefined) {
        shot.startTimeOffset.nanos = 0;
      }
      if (shot.endTimeOffset.seconds === undefined) {
        shot.endTimeOffset.seconds = 0;
      }
      if (shot.endTimeOffset.nanos === undefined) {
        shot.endTimeOffset.nanos = 0;
      }
      console.log(`\tStart: ${shot.startTimeOffset.seconds}` +
          `.${(shot.startTimeOffset.nanos / 1e6).toFixed(0)}s`);
      console.log(`\tEnd: ${shot.endTimeOffset.seconds}.` +
          `${(shot.endTimeOffset.nanos / 1e6).toFixed(0)}s`);

      var myObj = {
        id: shotIdx,
        startTime: (shot.startTimeOffset.nanos / 1e6),
        endTime: (shot.endTimeOffset.nanos / 1e6)
      }
      res.push(myObj);
    });

  }
  console.log("Res:", res)
})
.catch((err) => {
  console.error('ERROR:', err);
});
// [END videointelligence_quickstart]
