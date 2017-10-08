// STUFF TODO:

// 2. fix the sentiment params
// 3. make frame algorithm
// 4. make claps, etc algorithm
// 5. build frontend

'use strict';
const vttToJson = require("vtt-to-json")
var fs = require("fs");
var jsonfile = require('jsonfile')
const express = require('express')
const app = express()
const axios = require('axios')

const Video = require('@google-cloud/video-intelligence');
const Language = require('@google-cloud/language');

// Instantiates a client
const video = Video();
const language = Language();

const excitedWords = ["claps", "cheers", "applause", "(applause)", "laughter", "laugh", "laughing", "AUDIENCE", "LAUGHING", "excited", "wow", "crazy", "drum", "roll", "drum roll", "(drumroll)"]

function eq(a, b){
    var l = (a < b) ? a.length : b.length
    var l2 = (a > b) ? a.length : b.length
    var threshold = 0.8 * l2 > l2 - 3 ? 0.8 * l2 : l2 - 3
    var count = 0

    for(var i = 0; i < l; i++){
        if(a[i] === b[i]){
            count++
        }
    }

    if (count >= threshold){
        //console.log(a, b)
        return true
    }
    return false
}

function matcher(a, b){
    var matches = 0
    for (var s of a)
    {
        for (var t of b)
        {
            if (eq(s,t)){
                matches++
            }
        }
    }
    return matches
}

app.get('/applause', (req,res) => {
    fs.readFile("test.txt", function (err, data) {
        if (err) throw err;
        let input = data.toString();
        var sentences = []
        vttToJson(input)
        .then((result) => {
            var sentence = ""
            var prevStart = result[0].start
            result.forEach((object, index) => {
                sentence += object.part
                if (object.part.indexOf(".") !== -1 || object.part.indexOf("?") !== -1 ){
                    sentence = sentence + " "
                    sentences.push({
                        sentence,
                        start: prevStart,
                        end: object.end
                    })
                    sentence = ""
                    prevStart = object.end
                }
                if (index == result.length-1){
                    var final = []
                    var noise = []
                    var i,j,temparray,chunk = 5;
                    for (i=0,j=sentences.length; i<j-chunk; i+=chunk) {
                        temparray = sentences.slice(i,i+chunk);
                        temparray.forEach((oj) => {
                            if (matcher(oj.sentence.split(' '), excitedWords) > 0){
                                noise.push(oj)
                            }
                        })
                    }
                    for (; i < j; i++){
                        noise.push(sentences[i])
                    }
                    res.send(noise);
                }
            })
        });
    });
})

app.get('/', (req, res) => {
    fs.readFile("test.txt", function (err, data) {
        if (err) throw err;
        let input = data.toString();
        var sentences = []
        vttToJson(input)
        .then((result) => {
            var sentence = ""
            var prevStart = result[0].start
            result.forEach((object, index) => {
                sentence += object.part
                if (object.part.indexOf(".") !== -1 || object.part.indexOf("?") !== -1 ){
                    sentence = sentence + " "
                    sentences.push({
                        sentence,
                        start: prevStart,
                        end: object.end
                    })
                    sentence = ""
                    prevStart = object.end
                }
                if (index == result.length-1){
                    var final = []
                    var noise = []
                    var temparray = []
                    var i,j,temparray,chunk = 5;
                    for (i=0,j=sentences.length; i<j-chunk; i+=chunk) {
                        temparray = sentences.slice(i,i+chunk);
                        var groupSentence = ""
                        temparray.forEach((oj) => {
                            groupSentence += (" " + oj.sentence)
                        })
                        final.push({
                            sentence: groupSentence,
                            start: temparray[0].start,
                            end: temparray[chunk-1].end
                        })
                    }
                    for (; i < j; i++){
                        final.push(sentences[i])
                    }
                    var initLength = sentences[i-1].end - final[0].start
                    console.log("Initial Length:", initLength)
                    res.send(final);
                }
            })
        });
    });
})

app.get('/sentiment', (req, res) => {
  console.log("Begin sentiment analysis...")
  axios.get('http://localhost:5000/').then((result) => {
      var ret = [];
      var counter = 0
      result.data.forEach((stuff) => {
        const document = {
          'content': stuff["sentence"],
          type: 'PLAIN_TEXT'
        }
        return language.analyzeSentiment({'document': document})
          .then((results) => {
              counter++
              const sentiment = results[0].documentSentiment;

              var pushMe = stuff
              pushMe.score = sentiment.score,
              pushMe.magnitude = sentiment.magnitude

              ret.push(pushMe)
              if (counter === result.data.length){
                  var newArray = ret.sort(function(first, second) {
                    var a = first.start;
                    var b = second.start;
                    if(a > b) {
                        return 1;
                    } else if(a < b) {
                        return -1;
                    } else {
                        return 0;
                    }
                  });
                res.send(newArray)
              }
          })
        .catch((err) => {
            console.error('ERROR:', err);
        });
      })
    })
})

function average(data){
  var sumP = 0;
  var sumN = 0;
  var runP = 0;
  var runN = 0;
  for(var cluster in data){
      var sentence = data[cluster];
      var senti = sentence.score;
      if(senti > 0){
          sumP += senti;
          runP += 1;
      }
      else if(senti < 0){
        sumN += senti;
        runN += 1;
      }

  }
  var meanP = sumP/runP;
  var meanN = sumN/runN;

  console.log(meanP, meanN)

  var positive = [];
  var negative = [];

  for(var cluster in data){
      var sentence = data[cluster];
      var senti = sentence.score;
      if(senti - 0.05 > 0 && sentence.magnitude > 2){
          if(senti > meanP){
            positive.push(sentence);
          }
      }
      else if(senti < 0){
        if(senti < meanN){
            negative.push(sentence);
          }
      }
  }
  return ({
    positive,
    negative
  })
}

app.get('/filtered', (req,res) => {
  console.log('Begin sentiment filtration')
    axios.get('http://localhost:5000/sentiment').then((result) => {
      var x = average(result.data)
      var totalTime = 0
      axios.get('http://localhost:5000/applause').then((result) => {
          var total = x.positive.concat(result.data)
          var newArray = total.sort(function(first, second) {
            var a = first.start;
            var b = second.start;
            if(a > b) {
                return 1;
            } else if(a < b) {
                return -1;
            } else {
                return 0;
            }
          });
          total.forEach((obj) => {
              totalTime += obj.end - obj.start
          })
          console.log("Cut Time:", totalTime)
          res.send(total)
      })
    })
})

// The GCS filepath of the video to analyze from google cloud storage
const gcsUri = 'gs://io-video1/pixelEvent.mp4';

var shotsPixelVideo = require('./shots')

function getClosestFrame(start) {
  var min_diff = 1000000000
  var currStart = shotsPixelVideo[0].startTime;
  for(var i=0; i<shotsPixelVideo.length; i++) {
    if(start - shotsPixelVideo[i].startTime - 24.5> 0 && start - shotsPixelVideo[i].startTime - 24.5 < min_diff){
       min_diff = start - shotsPixelVideo[i].startTime
       currStart = shotsPixelVideo[i].startTime
    }
  }
  return currStart*1000;
}

var shotsBillGatesVideo = require('./shots2')

function getClosestFrame2(start) {
  var min_diff = 1000000000
  var currStart = shotsBillGatesVideo[0].startTime;
  for(var i=0; i<shotsBillGatesVideo.length; i++) {
    if(start - shotsBillGatesVideo[i].startTime - 24.5> 0 && start - shotsBillGatesVideo[i].startTime - 24.5 < min_diff){
       min_diff = start - shotsBillGatesVideo[i].startTime
       currStart = shotsBillGatesVideo[i].startTime
    }
  }
  return currStart*1000;
}

app.get('/intervals2', (req, res) => {
  axios.get('http://localhost:5000/filtered').then((result) => {
      var json = []
      var data = result.data
      var usedStartingFrames = new Set();
      for(var i=0; i<data.length; i++) {
        if(i > 0) {
          if(data[i].start == data[i-1].end) {
            var obj = {start : data[i].start, end: data[i].end}
            json.push(obj)
          }
          else if(data[i].start > data[i-1].end){
            var frame = getClosestFrame2(data[i].start/1000)
            if(!usedStartingFrames.has(frame)){
              if(data[i].start - frame > 5000) {
                frame = data[i].start
                var obj = {start: frame, end: data[i].end}
                json.push(obj)
              }
              else {
                var obj = {start: frame, end: data[i].end}
                json.push(obj)
                usedStartingFrames.add(frame)
              }
            }
            else {
              if(data[i].start - data[i-1].end > 5000) {
                var obj = {start: data[i].start, end: data[i].end}
                json.push(obj)
              }
              else {
                var obj = {start: data[i-1].end, end: data[i].end}
                json.push(obj)
              }
            }
          }
        }
        else {
          var frame = getClosestFrame2(data[i].start/1000)
          if(!usedStartingFrames.has(frame)){
            var obj = {start: frame, end: data[i].end}
            json.push(obj)
            usedStartingFrames.add(frame)
          }
        }
      }
      res.send(json)
    })
})

app.get('/intervals', (req, res) => {
  axios.get('http://localhost:5000/filtered').then((result) => {
      var json = []
      var data = result.data

      var usedStartingFrames = new Set();
      for(var i=0; i<data.length; i++) {
        if(i > 0) {
          if(data[i].start == data[i-1].end) {
            var obj = {start : data[i].start, end: data[i].end}
            json.push(obj)
          }
          else if(data[i].start > data[i-1].end){
            var frame = getClosestFrame(data[i].start/1000)
            if(!usedStartingFrames.has(frame)){
              if(data[i].start - frame > 5000) {
                frame = data[i].start
                var obj = {start: frame, end: data[i].end}
                json.push(obj)
              }
              else {
                var obj = {start: frame, end: data[i].end}
                json.push(obj)
                usedStartingFrames.add(frame)
              }
            }
            else {
              if(data[i].start - data[i-1].end > 5000) {
                var obj = {start: data[i].start, end: data[i].end}
                json.push(obj)
              }
              else {
                var obj = {start: data[i-1].end, end: data[i].end}
                json.push(obj)
              }
            }
          }
        }
        else {
          var frame = getClosestFrame(data[i].start/1000)
          if(!usedStartingFrames.has(frame)){
            var obj = {start: frame, end: data[i].end}
            json.push(obj)
            usedStartingFrames.add(frame)
          }
        }
      }
      res.send(json)
    })
})

// Construct request
const request = {
  inputUri: gcsUri,
  features: ['SHOT_CHANGE_DETECTION']
};

app.get('/shot', (req, res) => {
  // // Execute request
  var ret = []

  video.annotateVideo(request)
  .then((results) => {
    const operation = results[0];
    console.log('Begin frame analysis...');
    return operation.promise();
  })
  .then((results) => {
    // Gets shot changes
    const shotChanges = results[0].annotationResults[0].shotAnnotations;
    if (shotChanges.length === 1) {
      // console.log(`The entire video is one shot.`);
    } else {
      shotChanges.forEach((shot, shotIdx) => {
        // console.log(`Scene ${shotIdx} occurs from:`);
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
        var start = (shot.startTimeOffset.seconds + ((shot.startTimeOffset.nanos / 1e6).toFixed(0)))/1000
        var end = (shot.endTimeOffset.seconds + ((shot.endTimeOffset.nanos / 1e6).toFixed(0)))/1000
        var myObj = {
          id: shotIdx,
          startTime: start,
          endTime: end
        }
        ret.push(myObj);
      });
      res.send(ret)
    }
  })
  .catch((err) => {
    console.error('ERROR:', err);
  });
})


  const PORT = process.env.PORT || 5000;
  app.listen(PORT)
  console.log("Started backend server on port", PORT)
